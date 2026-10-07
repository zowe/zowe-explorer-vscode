import { useState, useEffect, useMemo } from "react";
import * as l10n from "@vscode/l10n";
import { getOriginalProfileKeyWithNested, mergePendingChangesForProfile, isPropertySecure } from "../utils/profileUtils";
import { flattenProfiles } from "../utils/configUtils";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";
import { ProfileSearchFilter } from "./ProfileSearchFilter";
import { ProfileTree } from "./ProfileTree";
import { useIsLightTheme } from "../hooks/useIsLightTheme";
import { useScrollToSelected } from "../hooks/useScrollToSelected";
import { ProfileTypeBadge } from "./ProfileTypeBadge";
import { DefaultStarButton } from "./DefaultStarButton";

interface ProfileListProps {
  sortedProfileKeys: string[];
  selectedProfileKey: string | null;
  pendingProfiles: { [key: string]: any };
  profileMenuOpen: string | null;
  configPath: string;
  vscodeApi: any;
  onProfileSelect: (profileKey: string) => void;
  onProfileMenuToggle: (profileKey: string | null) => void;
  onDeleteProfile: (profileKey: string) => void;
  onSetAsDefault: (profileKey: string) => void;
  isProfileDefault: (profileKey: string) => boolean;
  getProfileType: (profileKey: string) => string | null;
  viewMode: "flat" | "tree";
  hasPendingSecureChanges: (profileKey: string) => boolean;
  hasPendingRename: (profileKey: string) => boolean;
  hasPendingDefaultChange: (profileKey: string) => boolean;
  searchTerm: string;
  filterType: string | null;
  onSearchChange: (searchTerm: string) => void;
  onFilterChange: (filterType: string | null) => void;
  profileSortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults";
  onProfileSortOrderChange: (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults") => void;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  onProfileRename?: (originalKey: string, newKey: string, isDragDrop?: boolean) => boolean;
  configurations?: any[];
  selectedTab?: number | null;
  renames?: { [configPath: string]: { [originalKey: string]: string } };
  setPendingDefaults?: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: { value: string; path: string[] } } }>>;
  onViewModeToggle?: () => void;
}

export function ProfileList({
  sortedProfileKeys,
  selectedProfileKey,
  pendingProfiles,
  onProfileSelect,
  onDeleteProfile,
  onSetAsDefault,
  isProfileDefault,
  getProfileType,
  viewMode,
  hasPendingSecureChanges,
  hasPendingRename,
  hasPendingDefaultChange,
  searchTerm,
  filterType,
  onSearchChange,
  onFilterChange,
  profileSortOrder,
  onProfileSortOrderChange,
  expandedNodes,
  setExpandedNodes,
  onProfileRename,
  configurations,
  selectedTab,
  renames,
  setPendingDefaults,
  onViewModeToggle,
}: ProfileListProps) {
  const [filteredProfileKeys, setFilteredProfileKeys] = useState<string[]>(sortedProfileKeys);
  const [isFilteringActive, setIsFilteringActive] = useState<boolean>(false);
  const [lastSelectedProfileKey, setLastSelectedProfileKey] = useState<string | null>(null);
  const scrollContainerRef = useScrollToSelected(selectedProfileKey);
  const isLightTheme = useIsLightTheme();

  const findOriginalKey = useMemo(() => {
    return (currentKey: string): string => {
      if (!configurations || selectedTab === null || selectedTab === undefined || !renames) {
        return currentKey;
      }

      const configPath = configurations[selectedTab]?.configPath;
      if (!configPath || !renames[configPath]) {
        return currentKey;
      }

      return getOriginalProfileKeyWithNested(currentKey, configPath, renames);
    };
  }, [configurations, selectedTab, renames]);

  const {
    profileClipboard,
    setProfileClipboard,
    setPendingChanges,
    pendingChanges,
    configurations: ctxConfigurations,
    selectedTab: ctxSelectedTab,
    renames: ctxRenames,
    setDeletions,
    setPendingDefaults: ctxSetPendingDefaults,
    setRenameProfileModalOpen,
  } = useConfigContext();
  const { isProfileAffectedByDragDrop } = useUtilityHelpers();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profileKey: string | null } | null>(null);

  const copyProfile = (profileKey: string, isCut: boolean) => {
    const currentTab = ctxSelectedTab !== null && ctxSelectedTab !== undefined ? ctxSelectedTab : selectedTab;
    const currentConfigs = ctxConfigurations || configurations;
    const currentRenames = ctxRenames || renames;
    const config = currentConfigs && currentTab !== null && currentTab !== undefined ? currentConfigs[currentTab] : null;
    if (!config) {
      return;
    }
    const configPath = config.configPath;
    const profilesObj = config.properties?.profiles || {};
    const flatProfiles = flattenProfiles(profilesObj);
    const allConfigProfileKeys = Array.from(new Set([...sortedProfileKeys, ...Object.keys(flatProfiles), ...Object.keys(pendingProfiles)]));
    const relatedProfileKeys = allConfigProfileKeys.filter((k) => k === profileKey || k.startsWith(profileKey + "."));
    const getProfileJsonPath = (pk: string): string[] => {
      const parts = pk.split(".");
      const pathArr: string[] = ["profiles"];
      for (let i = 0; i < parts.length; i++) {
        pathArr.push(parts[i]);
        if (i < parts.length - 1) {
          pathArr.push("profiles");
        }
      }
      return pathArr;
    };
    const profilesData: { [k: string]: any } = {};
    for (const pKey of relatedProfileKeys) {
      const pType = getProfileType(pKey);
      const oldProfilePath = getProfileJsonPath(pKey);
      const baseProperties = (flatProfiles[pKey]?.properties as Record<string, unknown>) || {};
      const mergedProperties = mergePendingChangesForProfile({
        baseObj: baseProperties,
        path: [...oldProfilePath, "properties"],
        configPath,
        pendingChanges,
        renames: currentRenames || {},
      });
      const secureArray: string[] = [];
      Object.keys(mergedProperties).forEach((propKey) => {
        const isSecure = isPropertySecure({
          fullKey: [...oldProfilePath, "properties", propKey].join("."),
          displayKey: propKey,
          path: [...oldProfilePath, "properties", propKey],
          selectedTab: currentTab,
          configurations: currentConfigs,
          pendingChanges,
          renames: currentRenames,
        });
        if (isSecure) {
          secureArray.push(propKey);
        }
      });
      const customFields: Record<string, any> = {};
      const baseProfile = (flatProfiles[pKey] as Record<string, unknown>) || {};
      Object.keys(baseProfile).forEach((bk) => {
        if (bk !== "properties" && bk !== "profiles" && bk !== "type" && bk !== "secure") {
          customFields[bk] = baseProfile[bk];
        }
      });
      profilesData[pKey] = {
        profileKey: pKey,
        type: pType,
        properties: mergedProperties,
        secure: secureArray,
        customFields,
      };
    }
    setProfileClipboard({
      type: isCut ? "cut" : "copy",
      sourceKey: profileKey,
      configPath,
      profiles: profilesData,
    });
  };

  const duplicateProfile = (profileKey: string) => {
    const currentTab = ctxSelectedTab !== null && ctxSelectedTab !== undefined ? ctxSelectedTab : selectedTab;
    const currentConfigs = ctxConfigurations || configurations;
    const currentRenames = ctxRenames || renames;
    const config = currentConfigs && currentTab !== null && currentTab !== undefined ? currentConfigs[currentTab] : null;
    if (!config) {
      return;
    }
    const configPath = config.configPath;
    const profilesObj = config.properties?.profiles || {};
    const flatProfiles = flattenProfiles(profilesObj);
    const allConfigProfileKeys = Array.from(new Set([...sortedProfileKeys, ...Object.keys(flatProfiles), ...Object.keys(pendingProfiles)]));
    const relatedProfileKeys = allConfigProfileKeys.filter((k) => k === profileKey || k.startsWith(profileKey + "."));
    const getProfileJsonPath = (pk: string): string[] => {
      const parts = pk.split(".");
      const pathArr: string[] = ["profiles"];
      for (let i = 0; i < parts.length; i++) {
        pathArr.push(parts[i]);
        if (i < parts.length - 1) {
          pathArr.push("profiles");
        }
      }
      return pathArr;
    };
    const profilesData: { [k: string]: any } = {};
    for (const pKey of relatedProfileKeys) {
      const pType = getProfileType(pKey);
      const oldProfilePath = getProfileJsonPath(pKey);
      const baseProperties = (flatProfiles[pKey]?.properties as Record<string, unknown>) || {};
      const mergedProperties = mergePendingChangesForProfile({
        baseObj: baseProperties,
        path: [...oldProfilePath, "properties"],
        configPath,
        pendingChanges,
        renames: currentRenames || {},
      });
      const secureArray: string[] = [];
      Object.keys(mergedProperties).forEach((propKey) => {
        const isSecure = isPropertySecure({
          fullKey: [...oldProfilePath, "properties", propKey].join("."),
          displayKey: propKey,
          path: [...oldProfilePath, "properties", propKey],
          selectedTab: currentTab,
          configurations: currentConfigs,
          pendingChanges,
          renames: currentRenames,
        });
        if (isSecure) {
          secureArray.push(propKey);
        }
      });
      const customFields: Record<string, any> = {};
      const baseProfile = (flatProfiles[pKey] as Record<string, unknown>) || {};
      Object.keys(baseProfile).forEach((bk) => {
        if (bk !== "properties" && bk !== "profiles" && bk !== "type" && bk !== "secure") {
          customFields[bk] = baseProfile[bk];
        }
      });
      profilesData[pKey] = {
        profileKey: pKey,
        type: pType,
        properties: mergedProperties,
        secure: secureArray,
        customFields,
      };
    }
    let parentKey: string | null = null;
    if (profileKey.includes(".")) {
      parentKey = profileKey.substring(0, profileKey.lastIndexOf("."));
    }
    const leafName = profileKey.split(".").pop() || profileKey;
    const proposedLeafName = leafName + "_copy";
    const proposedKey = parentKey ? `${parentKey}.${proposedLeafName}` : proposedLeafName;
    const allCurrentProfileKeys = [...sortedProfileKeys, ...Object.keys(pendingProfiles)];
    if (currentRenames && currentRenames[configPath]) {
      allCurrentProfileKeys.push(...Object.values(currentRenames[configPath]));
    }
    let destKey = proposedKey;
    if (allCurrentProfileKeys.includes(proposedKey)) {
      let counter = 1;
      let uniqueNewProfileKey = `${proposedKey}_1`;
      while (allCurrentProfileKeys.includes(uniqueNewProfileKey)) {
        counter++;
        uniqueNewProfileKey = `${proposedKey}_${counter}`;
      }
      destKey = uniqueNewProfileKey;
    }
    const newChanges: { [k: string]: any } = {};
    Object.entries(profilesData).forEach(([pKey, pData]) => {
      const suffix = pKey.substring(profileKey.length);
      const newPKey = destKey + suffix;
      const newProfilePath = getProfileJsonPath(newPKey);
      if (pData.type) {
        const typeKey = [...newProfilePath, "type"].join(".");
        newChanges[typeKey] = {
          value: pData.type,
          path: ["type"],
          profile: newPKey,
        };
      }
      Object.entries(pData.properties).forEach(([propKey, propValue]) => {
        const propertyKey = [...newProfilePath, "properties", propKey].join(".");
        const isSecure = pData.secure.includes(propKey);
        newChanges[propertyKey] = {
          value: propValue,
          path: [propKey],
          profile: newPKey,
          secure: isSecure,
        };
      });
      if (pData.secure && pData.secure.length > 0) {
        const secureKey = [...newProfilePath, "secure"].join(".");
        newChanges[secureKey] = {
          value: pData.secure,
          path: ["secure"],
          profile: newPKey,
        };
      }
      Object.entries(pData.customFields).forEach(([bk, bkValue]) => {
        const bkKey = [...newProfilePath, bk].join(".");
        newChanges[bkKey] = {
          value: bkValue,
          path: [bk],
          profile: newPKey,
        };
      });
    });
    setPendingChanges((prev: any) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        ...newChanges,
      },
    }));
    onProfileSelect(destKey);
  };

  const pasteProfile = (targetProfileKey: string | null) => {
    if (!profileClipboard) {
      return;
    }
    const currentTab = ctxSelectedTab !== null && ctxSelectedTab !== undefined ? ctxSelectedTab : selectedTab;
    const currentConfigs = ctxConfigurations || configurations;
    const currentRenames = ctxRenames || renames;
    const config = currentConfigs && currentTab !== null && currentTab !== undefined ? currentConfigs[currentTab] : null;
    if (!config) {
      return;
    }
    const configPath = config.configPath;
    const leafName = profileClipboard.sourceKey.split(".").pop() || profileClipboard.sourceKey;
    const proposedKey = targetProfileKey ? `${targetProfileKey}.${leafName}` : leafName;
    const allCurrentProfileKeys = [...sortedProfileKeys, ...Object.keys(pendingProfiles)];
    if (currentRenames && currentRenames[configPath]) {
      allCurrentProfileKeys.push(...Object.values(currentRenames[configPath]));
    }
    let destKey = proposedKey;
    if (allCurrentProfileKeys.includes(proposedKey)) {
      let counter = 1;
      let uniqueNewProfileKey = `${proposedKey}_1`;
      while (allCurrentProfileKeys.includes(uniqueNewProfileKey)) {
        counter++;
        uniqueNewProfileKey = `${proposedKey}_${counter}`;
      }
      destKey = uniqueNewProfileKey;
    }
    if (profileClipboard.type === "cut") {
      if (profileClipboard.configPath === configPath) {
        if (destKey === profileClipboard.sourceKey) {
          return;
        }
        if (targetProfileKey === profileClipboard.sourceKey || targetProfileKey?.startsWith(profileClipboard.sourceKey + ".")) {
          return;
        }
        if (onProfileRename) {
          const originalKey = findOriginalKey(profileClipboard.sourceKey);
          onProfileRename(originalKey, destKey, true);
          setProfileClipboard(null);
        }
      } else {
        // Cut onto different layer (different configuration files)
        // 1. Copy the profile and descendants to the target layer
        const newChanges: { [k: string]: any } = {};
        const getProfileJsonPath = (pk: string): string[] => {
          const parts = pk.split(".");
          const pathArr: string[] = ["profiles"];
          for (let i = 0; i < parts.length; i++) {
            pathArr.push(parts[i]);
            if (i < parts.length - 1) {
              pathArr.push("profiles");
            }
          }
          return pathArr;
        };
        Object.entries(profileClipboard.profiles).forEach(([pKey, pData]) => {
          const suffix = pKey.substring(profileClipboard.sourceKey.length);
          const newPKey = destKey + suffix;
          const newProfilePath = getProfileJsonPath(newPKey);
          if (pData.type) {
            const typeKey = [...newProfilePath, "type"].join(".");
            newChanges[typeKey] = {
              value: pData.type,
              path: ["type"],
              profile: newPKey,
            };
          }
          Object.entries(pData.properties).forEach(([propKey, propValue]) => {
            const propertyKey = [...newProfilePath, "properties", propKey].join(".");
            const isSecure = pData.secure.includes(propKey);
            newChanges[propertyKey] = {
              value: propValue,
              path: [propKey],
              profile: newPKey,
              secure: isSecure,
            };
          });
          if (pData.secure && pData.secure.length > 0) {
            const secureKey = [...newProfilePath, "secure"].join(".");
            newChanges[secureKey] = {
              value: pData.secure,
              path: ["secure"],
              profile: newPKey,
            };
          }
          Object.entries(pData.customFields).forEach(([bk, bkValue]) => {
            const bkKey = [...newProfilePath, bk].join(".");
            newChanges[bkKey] = {
              value: bkValue,
              path: [bk],
              profile: newPKey,
            };
          });
        });
        setPendingChanges((prev: any) => ({
          ...prev,
          [configPath]: {
            ...prev[configPath],
            ...newChanges,
          },
        }));

        // 2. Delete the profile from the source layer
        const sourceFullProfilePath = getProfileJsonPath(profileClipboard.sourceKey).join(".");
        setDeletions((prev: any) => {
          const newDeletions = { ...prev };
          if (!newDeletions[profileClipboard.configPath]) {
            newDeletions[profileClipboard.configPath] = [];
          }
          newDeletions[profileClipboard.configPath].push(sourceFullProfilePath);
          return newDeletions;
        });

        // 3. Clear any pending changes for the source profile on the source layer
        setPendingChanges((prev: any) => {
          const newState = { ...prev };
          if (newState[profileClipboard.configPath]) {
            Object.keys(newState[profileClipboard.configPath]).forEach((key) => {
              const entry = newState[profileClipboard.configPath][key];
              if (entry.profile === profileClipboard.sourceKey || entry.profile.startsWith(profileClipboard.sourceKey + ".")) {
                delete newState[profileClipboard.configPath][key];
              }
            });
          }
          return newState;
        });

        // 4. Clear pending defaults in the source layer if the cut profile is set as default
        const sourceConfig = currentConfigs?.find((c: any) => c.configPath === profileClipboard.configPath);
        const sourceDefaults = sourceConfig?.properties?.defaults || {};
        const runSetPendingDefaults = ctxSetPendingDefaults || setPendingDefaults;
        if (runSetPendingDefaults) {
          runSetPendingDefaults((prev: any) => {
            const configPathDefaults = prev[profileClipboard.configPath] || {};
            const updatedDefaults = { ...configPathDefaults };
            let hasChanges = false;
            const profilesToCheck = [profileClipboard.sourceKey];

            Object.entries(updatedDefaults).forEach(([profileType, defaultEntry]) => {
              if (
                defaultEntry &&
                (profilesToCheck.includes((defaultEntry as any).value) ||
                  profilesToCheck.some((p) => (defaultEntry as any).value.startsWith(p + ".")))
              ) {
                updatedDefaults[profileType] = { value: "", path: [profileType] };
                hasChanges = true;
              }
            });

            Object.entries(sourceDefaults).forEach(([profileType, defaultProfileName]) => {
              const defaultProfileNameStr = String(defaultProfileName);
              if (profilesToCheck.includes(defaultProfileNameStr) || profilesToCheck.some((p) => defaultProfileNameStr.startsWith(p + "."))) {
                if (!updatedDefaults[profileType] || updatedDefaults[profileType].value !== "") {
                  updatedDefaults[profileType] = { value: "", path: [profileType] };
                  hasChanges = true;
                }
              }
            });

            if (hasChanges) {
              return {
                ...prev,
                [profileClipboard.configPath]: updatedDefaults,
              };
            }
            return prev;
          });
        }

        onProfileSelect(destKey);
        setProfileClipboard(null);
      }
    } else {
      const newChanges: { [k: string]: any } = {};
      const getProfileJsonPath = (pk: string): string[] => {
        const parts = pk.split(".");
        const pathArr: string[] = ["profiles"];
        for (let i = 0; i < parts.length; i++) {
          pathArr.push(parts[i]);
          if (i < parts.length - 1) {
            pathArr.push("profiles");
          }
        }
        return pathArr;
      };
      Object.entries(profileClipboard.profiles).forEach(([pKey, pData]) => {
        const suffix = pKey.substring(profileClipboard.sourceKey.length);
        const newPKey = destKey + suffix;
        const newProfilePath = getProfileJsonPath(newPKey);
        if (pData.type) {
          const typeKey = [...newProfilePath, "type"].join(".");
          newChanges[typeKey] = {
            value: pData.type,
            path: ["type"],
            profile: newPKey,
          };
        }
        Object.entries(pData.properties).forEach(([propKey, propValue]) => {
          const propertyKey = [...newProfilePath, "properties", propKey].join(".");
          const isSecure = pData.secure.includes(propKey);
          newChanges[propertyKey] = {
            value: propValue,
            path: [propKey],
            profile: newPKey,
            secure: isSecure,
          };
        });
        if (pData.secure && pData.secure.length > 0) {
          const secureKey = [...newProfilePath, "secure"].join(".");
          newChanges[secureKey] = {
            value: pData.secure,
            path: ["secure"],
            profile: newPKey,
          };
        }
        Object.entries(pData.customFields).forEach(([bk, bkValue]) => {
          const bkKey = [...newProfilePath, bk].join(".");
          newChanges[bkKey] = {
            value: bkValue,
            path: [bk],
            profile: newPKey,
          };
        });
      });
      setPendingChanges((prev: any) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          ...newChanges,
        },
      }));
      onProfileSelect(destKey);
    }
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => {
        document.removeEventListener("click", handleClick);
      };
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "VSCODE-TEXTFIELD" ||
          activeElement.tagName === "VSCODE-SINGLE-SELECT" ||
          (activeElement as HTMLElement).isContentEditable);
      if (isInputActive) {
        return;
      }
      const isModKey = e.ctrlKey || e.metaKey;
      if (!isModKey) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "x" && key !== "v") {
        return;
      }
      if (key === "c") {
        if (selectedProfileKey) {
          copyProfile(selectedProfileKey, false);
        }
      } else if (key === "x") {
        if (selectedProfileKey) {
          copyProfile(selectedProfileKey, true);
        }
      } else if (key === "v") {
        pasteProfile(selectedProfileKey);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedProfileKey,
    sortedProfileKeys,
    pendingProfiles,
    getProfileType,
    onProfileRename,
    onProfileSelect,
    profileClipboard,
    setProfileClipboard,
    setPendingChanges,
    pendingChanges,
    ctxConfigurations,
    configurations,
    ctxSelectedTab,
    selectedTab,
    ctxRenames,
    renames,
    findOriginalKey,
  ]);

  // Handle profile sort order change with auto-switch to flat view for type sorting
  const handleProfileSortOrderChange = (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults") => {
    onProfileSortOrderChange(sortOrder);

    // Auto-switch to flat view when type sorting is selected in tree view
    if (sortOrder === "type" && viewMode === "tree" && onViewModeToggle) {
      onViewModeToggle();
    }
  };

  // Get unique profile types for filter dropdown
  const availableTypes = Array.from(
    new Set(sortedProfileKeys.map((key) => getProfileType(key)).filter((type): type is string => type !== null && type.trim() !== ""))
  ).sort();

  // Filter and sort profiles based on search term, type filter, and sort order
  useEffect(() => {
    let filtered = sortedProfileKeys;
    let isFiltering = false;

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((profileKey) => {
        const leafName = profileKey.split(".").pop() ?? profileKey;
        return leafName.toLowerCase().includes(lowerSearchTerm);
      });
      isFiltering = true;
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter((profileKey) => getProfileType(profileKey) === filterType);
      isFiltering = true;
    }

    // Apply type sorting if enabled
    if (profileSortOrder === "type") {
      filtered = filtered.sort((a, b) => {
        const typeA = getProfileType(a);
        const typeB = getProfileType(b);

        // Profiles without types go to the end
        if (!typeA && !typeB) return a.localeCompare(b);
        if (!typeA) return 1;
        if (!typeB) return -1;

        // Sort by type first, then by name within the same type
        const typeComparison = typeA.localeCompare(typeB);
        if (typeComparison !== 0) return typeComparison;

        return a.localeCompare(b);
      });
    }

    // Apply defaults sorting if enabled
    if (profileSortOrder === "defaults") {
      filtered = filtered.sort((a, b) => {
        const isDefaultA = isProfileDefault(a);
        const isDefaultB = isProfileDefault(b);

        // Default profiles come first
        if (isDefaultA && !isDefaultB) return -1;
        if (!isDefaultA && isDefaultB) return 1;

        // Within the same default status, sort alphabetically
        return a.localeCompare(b);
      });
    }

    // For tree view, expand filtered results to include parent profiles of matching children
    if (viewMode === "tree") {
      filtered = expandFilteredResultsForTree(filtered, sortedProfileKeys);
    }

    setFilteredProfileKeys(filtered);
    setIsFilteringActive(isFiltering);
  }, [sortedProfileKeys, searchTerm, filterType, getProfileType, viewMode, profileSortOrder]);

  // Auto-expand parent nodes of selected profile to ensure it's visible
  // Only run this when the selected profile actually changes, not on every render
  useEffect(() => {
    if (viewMode === "tree" && selectedProfileKey && selectedProfileKey !== lastSelectedProfileKey) {
      const parts = selectedProfileKey.split(".");

      // Check if any parent nodes need to be expanded
      let needsExpansion = false;
      for (let i = 1; i < parts.length; i++) {
        const parentKey = parts.slice(0, i).join(".");
        if (sortedProfileKeys.includes(parentKey) && !expandedNodes.has(parentKey)) {
          needsExpansion = true;
          break;
        }
      }

      // Only expand if the selected profile is not visible due to collapsed parents
      if (needsExpansion) {
        const newExpandedNodes = new Set(expandedNodes);
        for (let i = 1; i < parts.length; i++) {
          const parentKey = parts.slice(0, i).join(".");
          if (sortedProfileKeys.includes(parentKey)) {
            newExpandedNodes.add(parentKey);
          }
        }
        setExpandedNodes(newExpandedNodes);
      }

      // Update the last selected profile key
      setLastSelectedProfileKey(selectedProfileKey);
    }
  }, [selectedProfileKey, viewMode, sortedProfileKeys, setExpandedNodes, lastSelectedProfileKey]);

  // Helper function to expand filtered results for tree view
  const expandFilteredResultsForTree = (filteredKeys: string[], allKeys: string[]): string[] => {
    const expandedKeys = new Set(filteredKeys);

    // For each filtered key, add all its parent profiles
    filteredKeys.forEach((profileKey) => {
      const parts = profileKey.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentKey = parts.slice(0, i).join(".");
        if (allKeys.includes(parentKey)) {
          expandedKeys.add(parentKey);
        }
      }
    });

    // Return the expanded keys in the original order from allKeys
    return allKeys.filter((key) => expandedKeys.has(key));
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        maxHeight: "400px",
        overflow: "hidden",
      }}
      data-testid="profile-list"
      data-view-mode={viewMode}
      data-profile-count={filteredProfileKeys.length}
      data-total-profiles={sortedProfileKeys.length}
    >
      {/* Search and Filter Component - Sticky */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--ce-card-background, var(--vscode-editor-background))",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <ProfileSearchFilter
          onSearchChange={onSearchChange}
          onFilterChange={onFilterChange}
          availableTypes={availableTypes}
          searchTerm={searchTerm}
          filterType={filterType}
          profileSortOrder={profileSortOrder}
          onProfileSortOrderChange={handleProfileSortOrderChange}
        />
      </div>
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "0 4px",
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const menuWidth = 150;
          const menuHeight = 50;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          let x = e.clientX;
          let y = e.clientY;
          if (x + menuWidth > viewportWidth) {
            x = viewportWidth - menuWidth - 10;
          }
          if (y + menuHeight > viewportHeight) {
            y = viewportHeight - menuHeight - 10;
          }
          setContextMenu({ x, y, profileKey: null });
        }}
      >
        {viewMode === "tree" ? (
          <ProfileTree
            profileKeys={filteredProfileKeys}
            selectedProfileKey={selectedProfileKey}
            pendingProfiles={pendingProfiles}
            onProfileSelect={onProfileSelect}
            onDeleteProfile={onDeleteProfile}
            isProfileDefault={isProfileDefault}
            getProfileType={getProfileType}
            hasPendingSecureChanges={hasPendingSecureChanges}
            hasPendingRename={hasPendingRename}
            hasPendingDefaultChange={hasPendingDefaultChange}
            isFilteringActive={isFilteringActive}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            onProfileRename={onProfileRename}
            configurations={configurations}
            selectedTab={selectedTab}
            renames={renames}
            onSetAsDefault={onSetAsDefault}
            setPendingDefaults={setPendingDefaults}
            onFilterChange={onFilterChange}
            filterType={filterType}
          />
        ) : (
          <>
            {filteredProfileKeys.map((profileKey) => {
              const rowHasPendingEdits =
                Boolean(pendingProfiles[profileKey]) ||
                hasPendingSecureChanges(profileKey) ||
                hasPendingRename(profileKey) ||
                hasPendingDefaultChange(profileKey);
              const isCut = !!(
                profileClipboard &&
                profileClipboard.type === "cut" &&
                (profileKey === profileClipboard.sourceKey || profileKey.startsWith(profileClipboard.sourceKey + "."))
              );
              return (
                <div
                  key={profileKey}
                  className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""} ${isCut ? "is-cut" : ""}`}
                  style={{
                    cursor: "pointer",
                    margin: "2px 0",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: selectedProfileKey === profileKey ? "2px solid var(--vscode-button-background)" : "2px solid transparent",
                    backgroundColor: "var(--vscode-input-background)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.9em",
                    minHeight: "28px",
                    opacity: isCut ? 0.5 : 1,
                    transition: "opacity 0.2s ease",
                  }}
                  tabIndex={0}
                  role="option"
                  aria-selected={selectedProfileKey === profileKey}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selectedProfileKey === profileKey) {
                        onProfileSelect("");
                      } else {
                        onProfileSelect(profileKey);
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onProfileSelect(profileKey);
                    const menuWidth = 150;
                    const menuHeight = 240;
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    let x = e.clientX;
                    let y = e.clientY;
                    if (x + menuWidth > viewportWidth) {
                      x = viewportWidth - menuWidth - 10;
                    }
                    if (y + menuHeight > viewportHeight) {
                      y = viewportHeight - menuHeight - 10;
                    }
                    setContextMenu({ x, y, profileKey });
                  }}
                  onClick={() => {
                    if (selectedProfileKey === profileKey) {
                      // If clicking on the already selected profile, deselect it
                      onProfileSelect("");
                    } else {
                      onProfileSelect(profileKey);
                    }
                  }}
                  title={profileKey}
                  data-testid="profile-list-item"
                  data-profile-key={profileKey}
                  data-profile-name={profileKey}
                  data-profile-type={getProfileType(profileKey)}
                  data-is-selected={selectedProfileKey === profileKey}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      overflow: "hidden",
                    }}
                    data-testid="profile-name"
                    data-profile-name={profileKey}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileKey}</span>
                    {rowHasPendingEdits && (
                      <span
                        className="codicon codicon-circle-filled pending-change-indicator"
                        title={l10n.t("Unsaved changes")}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    {getProfileType(profileKey) && (
                      <ProfileTypeBadge
                        profileType={getProfileType(profileKey)!}
                        isLightTheme={isLightTheme}
                        filterActive={filterType === getProfileType(profileKey)}
                        onToggleFilter={() => {
                          const profileType = getProfileType(profileKey);
                          if (profileType) {
                            // If clicking on the same type that's already filtered, clear the filter
                            onFilterChange(filterType === profileType ? null : profileType);
                          }
                        }}
                      />
                    )}
                    {getProfileType(profileKey) && (
                      <DefaultStarButton
                        variant="flat"
                        profileKey={profileKey}
                        profileType={getProfileType(profileKey)}
                        isDefault={isProfileDefault(profileKey)}
                        configurations={configurations}
                        selectedTab={selectedTab}
                        setPendingDefaults={setPendingDefaults}
                        onSetAsDefault={onSetAsDefault}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <div
              className="profile-list-empty-space"
              data-testid="profile-list-empty-space"
              style={{
                flex: 1,
                minHeight: "120px",
                width: "100%",
                cursor: "default",
              }}
              onClick={() => onProfileSelect("")}
            />
          </>
        )}
      </div>
      {contextMenu && (
        <div className="tab-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          {contextMenu.profileKey !== null ? (
            <>
              <div
                className="tab-context-menu-item"
                onClick={() => {
                  copyProfile(contextMenu.profileKey!, false);
                  setContextMenu(null);
                }}
              >
                <span className="codicon codicon-copy codicon-tab-menu-icon"></span>
                <span>{l10n.t("Copy")}</span>
              </div>
              <div
                className="tab-context-menu-item"
                onClick={() => {
                  copyProfile(contextMenu.profileKey!, true);
                  setContextMenu(null);
                }}
              >
                <span className="codicon codicon-screen-cut codicon-tab-menu-icon"></span>
                <span>{l10n.t("Cut")}</span>
              </div>
              {profileClipboard ? (
                <>
                  <div
                    className="tab-context-menu-item"
                    id="context-menu-paste-child-profile"
                    onClick={() => {
                      pasteProfile(contextMenu.profileKey);
                      setContextMenu(null);
                    }}
                  >
                    <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
                    <span>{l10n.t("Paste as Child")}</span>
                  </div>
                  <div
                    className="tab-context-menu-item"
                    id="context-menu-paste-root-profile"
                    onClick={() => {
                      pasteProfile(null);
                      setContextMenu(null);
                    }}
                  >
                    <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
                    <span>{l10n.t("Paste at Root Level")}</span>
                  </div>
                </>
              ) : (
                <div className="tab-context-menu-item disabled" id="context-menu-paste-profile">
                  <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
                  <span>{l10n.t("Paste")}</span>
                </div>
              )}
              <div
                className="tab-context-menu-item"
                onClick={() => {
                  duplicateProfile(contextMenu.profileKey!);
                  setContextMenu(null);
                }}
              >
                <span className="codicon codicon-files codicon-tab-menu-icon"></span>
                <span>{l10n.t("Duplicate")}</span>
              </div>
              <div
                className={`tab-context-menu-item ${isProfileAffectedByDragDrop(contextMenu.profileKey) ? "disabled" : ""}`}
                id="context-menu-rename-profile"
                title={
                  isProfileAffectedByDragDrop(contextMenu.profileKey)
                    ? l10n.t(
                        "Cannot rename: This profile or a related profile has been moved via drag-and-drop. Save and refresh to enable renaming."
                      )
                    : undefined
                }
                onClick={() => {
                  if (!isProfileAffectedByDragDrop(contextMenu.profileKey!)) {
                    onProfileSelect(contextMenu.profileKey!);
                    setRenameProfileModalOpen(true);
                    setContextMenu(null);
                  }
                }}
              >
                <span className="codicon codicon-edit codicon-tab-menu-icon"></span>
                <span>{l10n.t("Rename")}</span>
              </div>
              {onDeleteProfile && (
                <div
                  className="tab-context-menu-item"
                  onClick={() => {
                    onDeleteProfile(contextMenu.profileKey!);
                    setContextMenu(null);
                  }}
                >
                  <span className="codicon codicon-trash codicon-tab-menu-icon"></span>
                  <span>{l10n.t("Delete")}</span>
                </div>
              )}
            </>
          ) : (
            <div
              className={`tab-context-menu-item ${!profileClipboard ? "disabled" : ""}`}
              id="context-menu-paste-root"
              onClick={() => {
                if (profileClipboard) {
                  pasteProfile(null);
                }
                setContextMenu(null);
              }}
            >
              <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
              <span>{l10n.t("Paste")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
