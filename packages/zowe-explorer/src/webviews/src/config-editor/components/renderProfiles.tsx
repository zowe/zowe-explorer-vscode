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

import { useCallback, type SetStateAction } from "react";
import { ProfileList } from "./ProfileList";
import { getVisibleProfileKeys } from "../utils/profileKeyListing";
import type { ProfileMap } from "../types";
import { useEditorFields } from "../context/EditorStoreContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";

// Props interface for the renderProfiles component
interface RenderProfilesProps {
  profilesObj: ProfileMap;
}

export const RenderProfiles = ({ profilesObj }: RenderProfilesProps) => {
  const {
    handleProfileSelection,
    handleDeleteProfile,
    confirmDeleteProfile,
    handleSetAsDefault,
    handleRenameProfile,
    toggleViewMode: onViewModeToggle,
  } = useEditorFields(
    "handleProfileSelection",
    "handleDeleteProfile",
    "confirmDeleteProfile",
    "handleSetAsDefault",
    "handleRenameProfile",
    "toggleViewMode"
  );

  const {
    configurations,
    selectedTab,
    deletions,
    pendingChanges,
    renames,
    selectedProfileKey,
    profileMenuOpen,
    setProfileMenuOpen,
    vscodeApi,
    configEditorSettings,
    setProfileSortOrderWithStorage,
    setPendingDefaults,
    pendingDefaults,
  } = useEditorFields(
    "configurations",
    "selectedTab",
    "deletions",
    "pendingChanges",
    "renames",
    "selectedProfileKey",
    "profileMenuOpen",
    "setProfileMenuOpen",
    "vscodeApi",
    "configEditorSettings",
    "setProfileSortOrderWithStorage",
    "setPendingDefaults",
    "pendingDefaults"
  );

  const { viewMode, profileSortOrder } = configEditorSettings;

  const {
    extractPendingProfiles,
    getProfileType,
    hasPendingSecureChangesForProfile,
    hasPendingPropertyDeletions,
    hasPendingRename,
    isProfileDefault,
    getExpandedNodesForConfig,
    setExpandedNodesForConfig,
  } = useUtilityHelpers();

  const setExpandedNodesForProfileList = useCallback(
    (newExpandedNodes: SetStateAction<Set<string>>) => {
      const configPath = configurations[selectedTab!]?.configPath || "";
      if (typeof newExpandedNodes === "function") {
        setExpandedNodesForConfig(configPath, newExpandedNodes(getExpandedNodesForConfig(configPath)));
      } else {
        setExpandedNodesForConfig(configPath, newExpandedNodes);
      }
    },
    [selectedTab, configurations, setExpandedNodesForConfig, getExpandedNodesForConfig]
  );

  if (!profilesObj || typeof profilesObj !== "object" || selectedTab === null || !configurations[selectedTab]) return null;
  const configPath = configurations[selectedTab].configPath;
  const pendingProfiles = extractPendingProfiles(configPath);
  const sortedProfileKeys = getVisibleProfileKeys({
    profiles: profilesObj,
    pendingProfiles,
    configPath,
    renames,
    deletions,
    sortOrder: profileSortOrder,
  });

  return (
    <ProfileList
      sortedProfileKeys={sortedProfileKeys}
      selectedProfileKey={selectedProfileKey}
      pendingProfiles={pendingProfiles}
      profileMenuOpen={profileMenuOpen}
      configPath={configurations[selectedTab!]?.configPath || ""}
      vscodeApi={vscodeApi}
      onProfileSelect={handleProfileSelection}
      onProfileMenuToggle={setProfileMenuOpen}
      onDeleteProfile={confirmDeleteProfile || handleDeleteProfile}
      onSetAsDefault={handleSetAsDefault}
      isProfileDefault={isProfileDefault}
      getProfileType={(profileKey: string) => getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames)}
      viewMode={viewMode}
      hasPendingSecureChanges={(profileKey: string) =>
        hasPendingSecureChangesForProfile(profileKey, configurations[selectedTab!]?.configPath || "") ||
        hasPendingPropertyDeletions(profileKey, configurations[selectedTab!]?.configPath || "")
      }
      hasPendingRename={(profileKey: string) => hasPendingRename(profileKey, configurations[selectedTab!]?.configPath || "", renames)}
      hasPendingDefaultChange={(profileKey: string) => {
        const configPath = configurations[selectedTab!]?.configPath || "";
        const savedDefaults = (configurations[selectedTab!]?.properties?.defaults ?? {}) as { [profileType: string]: unknown };
        // A profile is "pending" if a staged default now points at it, or used to and no longer does.
        return Object.entries(pendingDefaults[configPath] ?? {}).some(
          ([profileType, entry]) => entry.value === profileKey || savedDefaults[profileType] === profileKey
        );
      }}
      profileSortOrder={profileSortOrder || "natural"}
      onProfileSortOrderChange={setProfileSortOrderWithStorage}
      expandedNodes={getExpandedNodesForConfig(configurations[selectedTab!]?.configPath || "")}
      setExpandedNodes={setExpandedNodesForProfileList}
      onProfileRename={handleRenameProfile}
      configurations={configurations}
      selectedTab={selectedTab}
      renames={renames}
      setPendingDefaults={setPendingDefaults}
      onViewModeToggle={onViewModeToggle}
    />
  );
};
