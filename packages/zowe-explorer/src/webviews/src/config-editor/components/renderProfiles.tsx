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

import React, { useCallback } from "react";

// Components
import { ProfileList } from "./ProfileList";

// Utils
import { getRenamedProfileKeyWithNested, ProfileSortOrder } from "../utils";

// Types
type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

type PendingChange = {
  value: string | number | boolean | Record<string, any>;
  path: string[];
  profile: string;
  secure?: boolean;
};

// Props interface for the renderProfiles component
interface RenderProfilesProps {
  profilesObj: any;
  configurations: Configuration[];
  selectedTab: number | null;
  deletions: { [configPath: string]: string[] };
  pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
  renames: { [configPath: string]: { [oldName: string]: string } };
  selectedProfileKey: string | null;
  profileMenuOpen: string | null;
  vscodeApi: any;
  viewMode: "flat" | "tree";
  profileSearchTerm: string;
  profileFilterType: string | null;
  profileSortOrder: ProfileSortOrder;

  // Handler functions
  handleProfileSelection: (profileKey: string) => void;
  setProfileMenuOpen: (profileKey: string | null) => void;
  handleDeleteProfile: (profileKey: string) => void;
  handleSetAsDefault: (profileKey: string) => void;
  handleRenameProfile: (originalKey: string, newKey: string, isDragDrop?: boolean) => boolean;
  setProfileSearchTerm: (term: string) => void;
  setProfileFilterType: (type: string | null) => void;
  setProfileSortOrderWithStorage: (order: ProfileSortOrder) => void;
  setExpandedNodesForConfig: (configPath: string, nodes: Set<string>) => void;
  setPendingDefaults: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: { value: string; path: string[] } } }>>;
  onViewModeToggle?: () => void;

  // Utility functions
  extractPendingProfiles: (configPath: string) => { [key: string]: any };
  isProfileOrParentDeleted: (profileKey: string, deletedProfiles: string[]) => boolean;
  getRenamedProfileKey: (originalKey: string, configPath: string, renames: { [configPath: string]: { [originalKey: string]: string } }) => string;
  getProfileType: (
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [oldName: string]: string } }
  ) => string | null;
  hasPendingSecureChanges: (profileKey: string) => boolean;
  hasPendingRename: (profileKey: string, configPath: string, renames: { [configPath: string]: { [oldName: string]: string } }) => boolean;
  isProfileDefault: (profileKey: string) => boolean;
  sortProfilesAtLevel: (profileKeys: string[]) => string[];
  getExpandedNodesForConfig: (configPath: string) => Set<string>;
}

export const RenderProfiles = ({
  profilesObj,
  configurations,
  selectedTab,
  deletions,
  pendingChanges,
  renames,
  selectedProfileKey,
  profileMenuOpen,
  vscodeApi,
  viewMode,
  profileSearchTerm,
  profileFilterType,
  profileSortOrder,
  handleProfileSelection,
  setProfileMenuOpen,
  handleDeleteProfile,
  handleSetAsDefault,
  handleRenameProfile,
  setProfileSearchTerm,
  setProfileFilterType,
  setProfileSortOrderWithStorage,
  setExpandedNodesForConfig,
  setPendingDefaults,
  onViewModeToggle,
  extractPendingProfiles,
  isProfileOrParentDeleted,
  getRenamedProfileKey,
  getProfileType,
  hasPendingSecureChanges,
  hasPendingRename,
  isProfileDefault,
  sortProfilesAtLevel,
  getExpandedNodesForConfig,
}: RenderProfilesProps) => {
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
      const getOrderedProfileKeys = (profiles: any, parentKey = ""): string[] => {
        const keys: string[] = [];

        // For natural sort order, preserve the exact order from Object.keys()
        // This maintains the original order as it appears in the configuration file
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          // Check if this profile should be excluded due to deletion
          let shouldExclude = false;

          // First check if the profile itself is deleted
          if (isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
            // But check if this profile has been renamed away from being a child of a deleted parent
            const renamedKey = getRenamedProfileKeyWithNested(qualifiedKey, configPath, renames);

            // If the renamed version is different and doesn't have deleted parents, don't exclude it
            if (renamedKey !== qualifiedKey && !isProfileOrParentDeleted(renamedKey, deletedProfiles)) {
              shouldExclude = false;
            } else {
              shouldExclude = true;
            }
          }

          // Add this profile key if it's not excluded
          if (!shouldExclude) {
            keys.push(qualifiedKey);
          }

          // Recursively add nested profiles
          if (profile.profiles) {
            keys.push(...getOrderedProfileKeys(profile.profiles, qualifiedKey));
          }
        }
        return keys;
      };

      // Get ordered profile keys from original configuration
      const orderedProfileKeys = getOrderedProfileKeys(profilesObj);

      // Apply renames to the profile keys, including nested profiles
      const renamedProfileKeys = orderedProfileKeys.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
      });

      // Filter out any renamed profile keys that are intermediate steps in a move operation
      // For example, if zosmf -> zosmf5 -> zftp.zosmf5, we don't want zosmf5 to appear in the root
      const configRenames = renames[configPath] || {};
      const finalRenamedProfileKeys = renamedProfileKeys.filter((renamedKey) => {
        // Check if this renamed key is an intermediate step (exists as an original key in renames)
        // If it exists as an original key, it means it's been moved further, so don't include it
        return !Object.keys(configRenames).includes(renamedKey);
      });

      // Add any renamed profiles that are not in the original configuration
      // This handles the case where a profile was renamed (e.g., zosmf -> zosmf5)
      const renamedOnlyProfiles = Object.keys(configRenames).filter((originalKey) => {
        // Only include if the original key is not in the ordered profile keys
        // This means it was renamed from a profile that doesn't exist in the original config
        if (orderedProfileKeys.includes(originalKey)) {
          return false;
        }

        // Filter out intermediate renames that are part of a chain
        // An intermediate rename is one where the originalKey is also a target of another rename
        // AND the newKey is also an originalKey (meaning it will be renamed again)
        const newKey = configRenames[originalKey];
        const isIntermediate = Object.values(configRenames).includes(originalKey) && Object.keys(configRenames).includes(newKey);
        if (isIntermediate) {
          return false;
        }

        return true;
      });

      // Apply renames to these renamed-only profiles
      const renamedOnlyProfileKeys = renamedOnlyProfiles.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
      });

      // Combine all renamed profile keys and remove duplicates
      const allRenamedProfileKeys = [...finalRenamedProfileKeys, ...renamedOnlyProfileKeys];

      // Remove duplicates from allRenamedProfileKeys
      const uniqueRenamedProfileKeys = Array.from(new Set(allRenamedProfileKeys));

      // Add all pending profiles - we'll filter out conflicts later
      const pendingProfileKeys = Object.keys(pendingProfiles).filter((key) => {
        // Check if this pending profile is deleted
        if (isProfileOrParentDeleted(key, deletedProfiles)) {
          return false;
        }

        // Include all pending profiles - we'll handle conflicts in the filtering step
        return true;
      });

      // Apply renames to pending profile keys as well, including nested profiles
      const renamedPendingProfileKeys = pendingProfileKeys.map((profileKey) => {
        let renamedKey = profileKey;
        const configRenames = renames[configPath] || {};

        // Apply renames iteratively to handle chained renames
        let changed = true;
        while (changed) {
          changed = false;
          for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (renamedKey === originalKey) {
              renamedKey = newKey;
              changed = true;
              break;
            }
            if (renamedKey.startsWith(originalKey + ".")) {
              const newRenamedKey = renamedKey.replace(originalKey + ".", newKey + ".");
              renamedKey = newRenamedKey;
              changed = true;
              break;
            }
          }
        }

        // Special case: if renames object is empty and this pending profile should be moved back to root
        // Check if this pending profile is a nested version of a root profile that should be moved back
        if (Object.keys(configRenames).length === 0 && renamedKey.includes(".")) {
          const rootProfileName = renamedKey.split(".").pop();
          if (rootProfileName && uniqueRenamedProfileKeys.includes(rootProfileName)) {
            // This pending profile should be renamed to the root profile name
            renamedKey = rootProfileName;
          }
        }

        return renamedKey;
      });

      // Filter out original profile keys that have pending profiles (renamed versions)
      const pendingProfileKeysSet = new Set(renamedPendingProfileKeys);
      const originalPendingProfileKeysSet = new Set(pendingProfileKeys);

      const filteredOriginalKeys = uniqueRenamedProfileKeys.filter((profileKey) => {
        // Check if this profile is deleted
        if (isProfileOrParentDeleted(profileKey, deletedProfiles)) {
          return false;
        }

        // If this profile key has a pending version (either renamed or original), filter it out
        const hasExactPendingMatch = pendingProfileKeysSet.has(profileKey) || originalPendingProfileKeysSet.has(profileKey);

        // Also check if this profile key is the result of a rename that has a pending version
        // For example, if we have renames {b: 'a.b', a.b: 'a.b1'} and pending profile 'b'
        // then 'a.b' should be filtered out because 'b' becomes 'a.b1' in pending
        const isResultOfRenameWithPending = Object.keys(renames[configPath] || {}).some((originalKey) => {
          const renamedKey = getRenamedProfileKeyWithNested(originalKey, configPath, renames);
          const hasPendingOriginal = Object.keys(pendingProfiles).includes(originalKey);
          const shouldFilter = profileKey === renamedKey && hasPendingOriginal;

          return shouldFilter;
        });

        // Additional check: if this profile key exists in the renamed pending profiles,
        // it means there's a pending profile that will become this key, so filter it out
        const isTargetOfPendingRename = renamedPendingProfileKeys.includes(profileKey);

        // Special case: if there's a pending profile that should be renamed to this key
        // but the renames object is empty, we need to check if the pending profile
        // should actually be renamed to this key (e.g., when moving back to original location)
        const shouldRenamePendingToThisKey =
          !isTargetOfPendingRename &&
          Object.keys(renames[configPath] || {}).length === 0 &&
          pendingProfileKeys.some((pendingKey) => {
            // Check if this pending profile should be renamed to the current profileKey
            // This happens when moving a profile back to its original location
            return (
              pendingKey !== profileKey &&
              (pendingKey.endsWith("." + profileKey) ||
                pendingKey === profileKey + ".pending" ||
                // Check if the pending profile is a nested version of this profile
                pendingKey.includes("." + profileKey + "."))
            );
          });

        const shouldKeep = !hasExactPendingMatch && !isResultOfRenameWithPending && !isTargetOfPendingRename && !shouldRenamePendingToThisKey;

        return shouldKeep;
      });

      let finalProfileKeys: string[];

      if (profileSortOrder === "natural") {
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
      getRenamedProfileKey,
      getRenamedProfileKeyWithNested,
      profileSortOrder || "natural",
      sortProfilesAtLevel,
    ]
  );

  return renderProfiles(profilesObj);
};
