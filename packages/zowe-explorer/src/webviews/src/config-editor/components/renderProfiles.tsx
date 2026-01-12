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

import { useCallback } from "react";
import { ProfileList } from "./ProfileList";
import {
  getRenamedProfileKeyWithNested,
  getOrderedProfileKeys,
  applyRenamesToProfileKeys,
  mergePendingProfileKeys,
  filterConflictingProfileKeys,
} from "../utils";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";

// Props interface for the renderProfiles component
interface RenderProfilesProps {
  profilesObj: any;

  // Handler functions
  handleProfileSelection: (profileKey: string) => void;
  handleDeleteProfile: (profileKey: string) => void;
  handleSetAsDefault: (profileKey: string) => void;
  handleRenameProfile: (originalKey: string, newKey: string, isDragDrop?: boolean) => boolean;
  onViewModeToggle?: () => void;
}

export const RenderProfiles = ({
  profilesObj,
  handleProfileSelection,
  handleDeleteProfile,
  handleSetAsDefault,
  handleRenameProfile,
  onViewModeToggle,
}: RenderProfilesProps) => {
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
    profileSearchTerm,
    profileFilterType,
    setProfileSearchTerm,
    setProfileFilterType,
    setProfileSortOrderWithStorage,
    setPendingDefaults,
  } = useConfigContext();

  const { viewMode, profileSortOrder } = configEditorSettings;

  const {
    extractPendingProfiles,
    getRenamedProfileKeyWithNested: getRenamedProfileKeyWithNestedHelper,
    getProfileType,
    hasPendingSecureChanges,
    hasPendingRename,
    isProfileDefault,
    sortProfilesAtLevel,
    getExpandedNodesForConfig,
    setExpandedNodesForConfig,
    isProfileOrParentDeletedForComponent: isProfileOrParentDeleted,
  } = useUtilityHelpers();
  const renderProfiles = useCallback(
    (profilesObj: any) => {
      if (!profilesObj || typeof profilesObj !== "object") return null;

      const configPath = configurations[selectedTab!]!.configPath;

      // Extract pending profiles using helper function
      const pendingProfiles = extractPendingProfiles(configPath);

      // Filter out deleted profiles and their children
      const deletedKeys = deletions[configPath] || [];

      // Parse deletion keys to extract profile names
      const deletedProfiles: string[] = [];
      deletedKeys.forEach((key) => {
        // Extract profile name from deletion key
        const keyParts = key.split(".");
        if (keyParts[0] === "profiles" && keyParts.length >= 2) {
          // Handle all profile types (simple, nested, deeply nested)
          // The deletion key structure is: profiles.profile1.profiles.profile2.profiles.profile3...
          // We need to extract: profile1.profile2.profile3...
          const profileParts: string[] = [];
          for (let i = 1; i < keyParts.length; i++) {
            if (keyParts[i] !== "profiles") {
              profileParts.push(keyParts[i]);
            }
          }
          const profileName = profileParts.join(".");
          deletedProfiles.push(profileName);

          // Also add the renamed version of the deleted profile if it exists
          const renamedDeletedProfile = getRenamedProfileKeyWithNested(profileName, configPath, renames);
          if (renamedDeletedProfile !== profileName) {
            deletedProfiles.push(renamedDeletedProfile);
          }
        }
      });

      // Get profile keys in original order from the configuration
      // For natural sort order, we need to preserve the exact order from the original configuration
      // Callback for getOrderedProfileKeys to handle deletion logic
      const checkIsProfileOrParentDeleted = (qualifiedKey: string, deletedProfilesList: string[]) => {
        // First check if the profile itself is deleted
        if (isProfileOrParentDeleted(qualifiedKey, deletedProfilesList)) {
          // But check if this profile has been renamed away from being a child of a deleted parent
          const renamedKey = getRenamedProfileKeyWithNested(qualifiedKey, configPath, renames);

          // If the renamed version is different and doesn't have deleted parents, don't exclude it
          if (renamedKey !== qualifiedKey && !isProfileOrParentDeleted(renamedKey, deletedProfilesList)) {
            return false;
          }
          return true;
        }
        return false;
      };

      // Get ordered profile keys using imported utility and callback
      const orderedProfileKeys = getOrderedProfileKeys(profilesObj, "", deletedProfiles, checkIsProfileOrParentDeleted);

      // Process profile keys using extracted utilities
      const uniqueRenamedProfileKeys = applyRenamesToProfileKeys(orderedProfileKeys, configPath, renames);

      const renamedPendingProfileKeys = mergePendingProfileKeys(pendingProfiles, configPath, renames, deletions, uniqueRenamedProfileKeys);

      const filteredOriginalKeys = filterConflictingProfileKeys(
        uniqueRenamedProfileKeys,
        renamedPendingProfileKeys,
        pendingProfiles,
        deletions,
        configPath,
        renames
      );

      let finalProfileKeys: string[];

      if (profileSortOrder === "natural") {
        const pendingProfileKeys = Object.keys(pendingProfiles);
        const pendingProfileKeysSet = new Set(renamedPendingProfileKeys);
        const originalPendingProfileKeysSet = new Set(pendingProfileKeys);

        // Create a map to track which profiles have pending versions
        const pendingMap = new Map<string, string>();
        renamedPendingProfileKeys.forEach((pendingKey) => {
          // Find the original key that this pending profile corresponds to
          const originalKey = Object.keys(pendingProfiles).find((origKey) => {
            const renamedKey = getRenamedProfileKeyWithNested(origKey, configPath, renames);
            return renamedKey === pendingKey;
          });
          if (originalKey) {
            // Map from the original key to the pending (possibly renamed) key
            pendingMap.set(originalKey, pendingKey);
          }
        });

        // Build the final list maintaining original order
        finalProfileKeys = [];
        const processedPendingKeys = new Set<string>();

        // Preserve the exact order from the original configuration
        uniqueRenamedProfileKeys.forEach((profileKey) => {
          // Check if this profile is deleted
          if (isProfileOrParentDeleted(profileKey, deletedProfiles)) {
            return;
          }

          // Check if this profile has a pending version
          const hasPendingVersion = pendingProfileKeysSet.has(profileKey) || originalPendingProfileKeysSet.has(profileKey);

          if (hasPendingVersion) {
            // Find the pending version key by looking up in pendingMap
            // Check if this profile key itself has a pending version
            let pendingKey = pendingMap.get(profileKey);

            // Check if this profile key is the result of a rename that has a pending version
            if (!pendingKey) {
              const originalKeyForThis = Object.keys(renames[configPath] || {}).find((origKey) => {
                const renamed = getRenamedProfileKeyWithNested(origKey, configPath, renames);
                return renamed === profileKey;
              });
              if (originalKeyForThis) {
                pendingKey = pendingMap.get(originalKeyForThis);
              }
            }

            if (pendingKey) {
              // Use the pending version instead of the original
              finalProfileKeys.push(pendingKey);
              processedPendingKeys.add(pendingKey);
            } else {
              // Couldn't find a pending version, keep the original
              finalProfileKeys.push(profileKey);
            }
          } else {
            // No pending version, use the original profile
            finalProfileKeys.push(profileKey);
          }
        });

        // Add any pending profiles that don't correspond to existing profiles (newly created profiles)
        // These should be added at the end to maintain the original order of existing profiles
        renamedPendingProfileKeys.forEach((pendingKey) => {
          if (!processedPendingKeys.has(pendingKey)) {
            finalProfileKeys.push(pendingKey);
          }
        });
      } else {
        // For other sort orders, use the existing logic
        finalProfileKeys = [...filteredOriginalKeys, ...renamedPendingProfileKeys];
      }

      // Apply profile sorting based on the current sort order
      let sortedProfileKeys: string[];

      if (profileSortOrder === "natural") {
        // For natural sort order, preserve the original order as it appears in the configuration
        sortedProfileKeys = [...finalProfileKeys];
      } else {
        // For other sort orders, use the existing logic
        sortedProfileKeys = sortProfilesAtLevel(finalProfileKeys);
      }

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
          onDeleteProfile={handleDeleteProfile}
          onSetAsDefault={handleSetAsDefault}
          isProfileDefault={isProfileDefault}
          getProfileType={(profileKey: string) => getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames)}
          viewMode={viewMode}
          hasPendingSecureChanges={hasPendingSecureChanges}
          hasPendingRename={(profileKey: string) => hasPendingRename(profileKey, configurations[selectedTab!]?.configPath || "", renames)}
          searchTerm={profileSearchTerm}
          filterType={profileFilterType}
          onSearchChange={setProfileSearchTerm}
          onFilterChange={setProfileFilterType}
          profileSortOrder={profileSortOrder || "natural"}
          onProfileSortOrderChange={setProfileSortOrderWithStorage}
          expandedNodes={getExpandedNodesForConfig(configurations[selectedTab!]?.configPath || "")}
          setExpandedNodes={useCallback(
            (newExpandedNodes) => {
              const configPath = configurations[selectedTab!]?.configPath || "";
              if (typeof newExpandedNodes === "function") {
                setExpandedNodesForConfig(configPath, newExpandedNodes(getExpandedNodesForConfig(configPath)));
              } else {
                setExpandedNodesForConfig(configPath, newExpandedNodes);
              }
            },
            [selectedTab, configurations, setExpandedNodesForConfig, getExpandedNodesForConfig]
          )}
          onProfileRename={handleRenameProfile}
          configurations={configurations}
          selectedTab={selectedTab}
          renames={renames}
          setPendingDefaults={setPendingDefaults}
          onViewModeToggle={onViewModeToggle}
        />
      );
    },
    [
      selectedTab,
      configurations,
      deletions,
      pendingChanges,
      renames,
      selectedProfileKey,
      profileMenuOpen,
      vscodeApi,
      handleProfileSelection,
      setProfileMenuOpen,
      handleDeleteProfile,
      handleSetAsDefault,
      isProfileDefault,
      getProfileType,
      viewMode,
      hasPendingSecureChanges,
      profileSearchTerm,
      profileFilterType,
      setProfileSearchTerm,
      setProfileFilterType,
      extractPendingProfiles,
      isProfileOrParentDeleted,
      getRenamedProfileKeyWithNestedHelper,
      getRenamedProfileKeyWithNested,
      profileSortOrder || "natural",
      sortProfilesAtLevel,
    ]
  );

  return renderProfiles(profilesObj);
};
