import React, { useState, useMemo, useRef, useEffect } from "react";
import * as l10n from "@vscode/l10n";
import { getOriginalProfileKeyWithNested, mergePendingChangesForProfile, isPropertySecure } from "../utils/profileUtils";
import { flattenProfiles } from "../utils/configUtils";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";
import { useIsLightTheme } from "../hooks/useIsLightTheme";
import { useScrollToSelected } from "../hooks/useScrollToSelected";
import { ProfileTypeBadge } from "./ProfileTypeBadge";
import { DefaultStarButton } from "./DefaultStarButton";

// Re-exported for backward compatibility with existing importers (e.g. ProfileList, tests).
export { getColorForProfileType, PROFILE_TYPE_COLORS, coreTypeColors, coreColors } from "../utils/profileColors";
export { useIsLightTheme };

/**
 * Given a proposed profile key for a drag-drop rename, return a non-conflicting key. If the
 * proposed key already exists (and isn't part of the dragged profile's own rename chain), a
 * numeric suffix is appended until the key is unique.
 */
function resolveDropTargetKey(params: {
  proposedKey: string;
  draggedProfile: string;
  profileKeys: string[];
  pendingProfiles: { [key: string]: any };
  renames?: { [configPath: string]: { [originalKey: string]: string } };
  configurations?: any[];
  selectedTab?: number | null;
  findOriginalKey: (currentKey: string) => string;
}): string {
  const { proposedKey, draggedProfile, profileKeys, pendingProfiles, renames, configurations, selectedTab, findOriginalKey } = params;

  // Get all current profile keys (including pending profiles and targets of pending renames)
  const allCurrentProfileKeys = [...profileKeys, ...Object.keys(pendingProfiles)];

  // Add profiles that are targets of pending renames to avoid conflicts
  if (renames && configurations && selectedTab !== null && selectedTab !== undefined) {
    const configPath = configurations[selectedTab]?.configPath;
    if (configPath && renames[configPath]) {
      const configRenames = renames[configPath];
      const renameTargets = Object.values(configRenames);
      allCurrentProfileKeys.push(...renameTargets);
    }
  }

  // Check if the new profile key already exists and is not the dragged profile itself
  if (allCurrentProfileKeys.includes(proposedKey) && proposedKey !== draggedProfile) {
    // Find the original key for the dragged profile to get all names in its rename chain
    const originalKey = findOriginalKey(draggedProfile);

    // Get all names that are part of the current rename chain for this profile
    const namesInRenameChain = new Set<string>();
    if (renames && configurations && selectedTab !== null && selectedTab !== undefined) {
      const configPath = configurations[selectedTab]?.configPath;
      if (configPath && renames[configPath]) {
        const configRenames = renames[configPath];

        // Add the original key
        namesInRenameChain.add(originalKey);

        // Follow the rename chain to collect all intermediate names
        let currentKey = originalKey;
        const visited = new Set<string>();
        while (configRenames[currentKey] && !visited.has(currentKey)) {
          visited.add(currentKey);
          namesInRenameChain.add(configRenames[currentKey]);
          currentKey = configRenames[currentKey];
        }
      }
    }

    // Only create a unique name if the conflict is not with a name in our rename chain
    if (!namesInRenameChain.has(proposedKey)) {
      // Find a unique name by appending a number
      let counter = 1;
      let uniqueNewProfileKey = `${proposedKey}_${counter}`;

      while (allCurrentProfileKeys.includes(uniqueNewProfileKey)) {
        counter++;
        uniqueNewProfileKey = `${proposedKey}_${counter}`;
      }

      return uniqueNewProfileKey;
    }
  }

  return proposedKey;
}

interface ProfileTreeProps {
  profileKeys: string[];
  selectedProfileKey: string | null;
  pendingProfiles: { [key: string]: any };
  onProfileSelect: (profileKey: string) => void;
  isProfileDefault: (profileKey: string) => boolean;
  getProfileType: (profileKey: string) => string | null;
  hasPendingSecureChanges: (profileKey: string) => boolean;
  hasPendingRename: (profileKey: string) => boolean;
  hasPendingDefaultChange: (profileKey: string) => boolean;
  isFilteringActive?: boolean;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  onProfileRename?: (originalKey: string, newKey: string, isDragDrop?: boolean) => boolean;
  onDeleteProfile?: (profileKey: string) => void;
  // Add props to help find original keys
  configurations?: any[];
  selectedTab?: number | null;
  renames?: { [configPath: string]: { [originalKey: string]: string } };
  onSetAsDefault?: (profileKey: string) => void;
  setPendingDefaults?: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: { value: string; path: string[] } } }>>;
  onFilterChange?: (filterType: string | null) => void;
  filterType?: string | null; // Added to support toggle behavior
}

interface ProfileNode {
  key: string;
  name: string;
  children: ProfileNode[];
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export function ProfileTree({
  profileKeys,
  selectedProfileKey,
  pendingProfiles,
  onProfileSelect,
  isProfileDefault,
  getProfileType,
  hasPendingSecureChanges,
  hasPendingRename,
  hasPendingDefaultChange,
  isFilteringActive,
  expandedNodes,
  setExpandedNodes,
  onProfileRename,
  onDeleteProfile,
  configurations,
  selectedTab,
  renames,
  onSetAsDefault,
  setPendingDefaults,
  onFilterChange,
  filterType,
}: ProfileTreeProps) {
  const hasNestedProfiles = profileKeys.some((key) => key.includes("."));

  const isLightTheme = useIsLightTheme();

  // Drag and drop state
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);
  const [dragOverProfile, setDragOverProfile] = useState<string | null>(null);
  const scrollContainerRef = useScrollToSelected(selectedProfileKey);

  const suppressNextClickRef = useRef(false);
  const activeDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => activeDragCleanupRef.current?.();
  }, []);

  // Memoized helper function to find the original key from a current profile key
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
    const allConfigProfileKeys = Array.from(new Set([...profileKeys, ...Object.keys(flatProfiles), ...Object.keys(pendingProfiles)]));
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
    const allConfigProfileKeys = Array.from(new Set([...profileKeys, ...Object.keys(flatProfiles), ...Object.keys(pendingProfiles)]));
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
    const allCurrentProfileKeys = [...profileKeys, ...Object.keys(pendingProfiles)];
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
    const allCurrentProfileKeys = [...profileKeys, ...Object.keys(pendingProfiles)];
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
    profileKeys,
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

  const getEffectiveExpandedNodes = (): Set<string> => {
    if (!isFilteringActive || !hasNestedProfiles) {
      return expandedNodes;
    }

    const autoExpanded = new Set(expandedNodes);

    profileKeys.forEach((key) => {
      const parts = key.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentKey = parts.slice(0, i).join(".");
        if (profileKeys.includes(parentKey)) {
          autoExpanded.add(parentKey);
        }
      }
    });

    return autoExpanded;
  };

  const buildTree = (keys: string[]): ProfileNode[] => {
    const nodes: ProfileNode[] = [];
    const nodeMap = new Map<string, ProfileNode>();
    const effectiveExpandedNodes = getEffectiveExpandedNodes();

    // First pass: create all nodes
    keys.forEach((key) => {
      const parts = key.split(".");
      const name = parts[parts.length - 1];
      const level = parts.length - 1;

      const node: ProfileNode = {
        key,
        name,
        children: [],
        level,
        hasChildren: false,
        isExpanded: effectiveExpandedNodes.has(key),
      };

      nodeMap.set(key, node);

      if (level === 0) {
        nodes.push(node);
      }
    });

    keys.forEach((key) => {
      const node = nodeMap.get(key);
      if (!node) return;

      const parts = key.split(".");
      if (parts.length > 1) {
        const parentKey = parts.slice(0, -1).join(".");
        const parentNode = nodeMap.get(parentKey);
        if (parentNode) {
          parentNode.children.push(node);
          parentNode.hasChildren = true;
        }
      }
    });

    return nodes;
  };

  const toggleNode = (nodeKey: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeKey)) {
      newExpanded.delete(nodeKey);
    } else {
      newExpanded.add(nodeKey);
    }
    setExpandedNodes(newExpanded);
  };

  // Helper function to detect complex rename chains that could cause performance issues

  // Compute the profile key that would result from dropping `sourceProfile` onto `targetProfileKey`,
  // resolving any naming conflicts. Shared by the actual drop handler and the hover preview label.
  const computeDropResultKey = (sourceProfile: string, targetProfileKey: string): string => {
    const sourceProfileName = sourceProfile.split(".").pop() || sourceProfile;

    let proposedKey: string;

    if (sourceProfile === targetProfileKey) {
      proposedKey = targetProfileKey;
    } else if (sourceProfile === `${targetProfileKey}.${sourceProfileName}`) {
      proposedKey = targetProfileKey;
    } else if (targetProfileKey === sourceProfileName) {
      proposedKey = targetProfileKey;
    } else if (targetProfileKey.endsWith(`.${sourceProfileName}`)) {
      proposedKey = targetProfileKey;
    } else {
      proposedKey = `${targetProfileKey}.${sourceProfileName}`;
    }

    return resolveDropTargetKey({
      proposedKey,
      draggedProfile: sourceProfile,
      profileKeys,
      pendingProfiles,
      renames,
      configurations,
      selectedTab,
      findOriginalKey,
    });
  };

  const performDrop = (sourceProfile: string, targetProfileKey: string) => {
    if (!onProfileRename || isInvalidDrop(sourceProfile, targetProfileKey)) {
      return;
    }

    const newProfileKey =
      targetProfileKey === "ROOT"
        ? resolveDropTargetKey({
            proposedKey: sourceProfile.split(".").pop() || sourceProfile,
            draggedProfile: sourceProfile,
            profileKeys,
            pendingProfiles,
            renames,
            configurations,
            selectedTab,
            findOriginalKey,
          })
        : computeDropResultKey(sourceProfile, targetProfileKey);

    if (sourceProfile !== newProfileKey) {
      const originalKey = findOriginalKey(sourceProfile);
      onProfileRename(originalKey, newProfileKey, true);
    }
  };

  // Helper function to check if a drop is invalid
  const isInvalidDrop = (sourceProfile: string, targetProfile: string): boolean => {
    // Can't drop on itself
    if (sourceProfile === targetProfile) {
      return true;
    }

    // Special case for root level - always allow dropping to root
    if (targetProfile === "ROOT") {
      return false;
    }

    // Can't drop a parent onto its child
    if (targetProfile.startsWith(sourceProfile + ".")) {
      return true;
    }

    // Can't drop if it would create a circular reference
    // But allow moving a profile to its parent or a different branch
    if (sourceProfile.startsWith(targetProfile + ".")) {
      // Check if this is dropping onto the immediate parent (which should be blocked)
      const sourceParent = sourceProfile.substring(0, sourceProfile.lastIndexOf("."));
      if (sourceParent === targetProfile) {
        return true;
      }

      // Check if this is a valid move up the hierarchy
      // Valid: moving a child to its grandparent or a different branch
      // Invalid: moving a profile to create a circular reference

      // Extract the remaining path after the target
      const remainingPath = sourceProfile.substring(targetProfile.length + 1);
      const sourceProfileName = sourceProfile.split(".").pop() || "";

      // If we're moving to a parent and the remaining path contains the source profile name,
      // this is likely a valid move up the hierarchy
      if (remainingPath.includes(sourceProfileName)) {
        return false;
      }

      // Otherwise, it might be a circular reference
      return true;
    }

    // Allow dropping onto any valid profile name, even if it doesn't currently exist
    // This handles cases where a profile was moved and we want to move it back
    return false;
  };

  // handleRowMouseDown's mousemove/mouseup listeners are attached once, at the start of a drag,
  // so they'd otherwise keep closing over stale profileKeys/renames/configurations for the whole
  // drag if any of that data changes mid-drag (e.g. an external config reload). Routing calls
  // through this ref (refreshed every render) keeps them reading the latest data instead.
  const dragHelpersRef = useRef({ isInvalidDrop, computeDropResultKey, performDrop, findOriginalKey });
  useEffect(() => {
    dragHelpersRef.current = { isInvalidDrop, computeDropResultKey, performDrop, findOriginalKey };
  });

  const DRAG_MOVE_THRESHOLD_PX = 4;

  const handleRowMouseDown = (e: any, profileKey: string) => {
    if (e.button !== 0) {
      return;
    }

    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    let moved = false;
    let ghost: HTMLDivElement | null = null;

    const positionGhost = (clientX: number, clientY: number) => {
      if (ghost) {
        ghost.style.transform = `translate(${clientX - offsetX}px, ${clientY - offsetY}px)`;
      }
    };

    const updateHoverTarget = (clientX: number, clientY: number): string | null => {
      const elements = ghost ? [ghost] : [];

      elements.forEach((el) => (el.style.visibility = "hidden"));
      const under = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      elements.forEach((el) => (el.style.visibility = "visible"));

      const targetEl = under?.closest("[data-profile-key]") as HTMLElement | null;
      const targetKey = targetEl?.getAttribute("data-profile-key") ?? null;

      if (targetKey && !dragHelpersRef.current.isInvalidDrop(profileKey, targetKey)) {
        setDragOverProfile(targetKey);
        return targetKey;
      }

      setDragOverProfile(null);
      return null;
    };

    let lastHoverTarget: string | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!moved) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < DRAG_MOVE_THRESHOLD_PX) {
          return;
        }

        moved = true;
        setDraggedProfile(profileKey);
        document.body.style.cursor = "grabbing";

        ghost = rowEl.cloneNode(true) as HTMLDivElement;
        // The cloned row carries over its own "transition: all 0.2s ease" (used for hover/select
        // animations), which would ease every transform update below instead of applying it
        // immediately — that's what made the ghost lag behind the cursor. Kill it explicitly.
        ghost.style.transition = "none";
        ghost.style.position = "fixed";
        ghost.style.left = "0";
        ghost.style.top = "0";
        ghost.style.width = `${rect.width}px`;
        ghost.style.margin = "0";
        ghost.style.pointerEvents = "none";
        ghost.style.zIndex = "10000";
        ghost.style.opacity = "0.9";
        ghost.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.35)";
        ghost.style.willChange = "transform";
        document.body.appendChild(ghost);
      }

      positionGhost(moveEvent.clientX, moveEvent.clientY);
      lastHoverTarget = updateHoverTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const cleanup = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      document.body.style.cursor = "";
      ghost?.remove();
      ghost = null;
      activeDragCleanupRef.current = null;
    };

    const onMouseUp = () => {
      if (moved) {
        suppressNextClickRef.current = true;
        if (lastHoverTarget) {
          dragHelpersRef.current.performDrop(profileKey, lastHoverTarget);
        }
      }
      setDraggedProfile(null);
      setDragOverProfile(null);
      cleanup();
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        setDraggedProfile(null);
        setDragOverProfile(null);
        cleanup();
      }
    };

    // If the mouse is released outside the webview (e.g. over the editor pane), no mouseup ever
    // reaches us. Losing window focus mid-drag is a reliable signal that this has happened, so
    // treat it the same as an Escape cancel instead of leaving the drag state stuck.
    const onWindowBlur = () => {
      setDraggedProfile(null);
      setDragOverProfile(null);
      cleanup();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onWindowBlur);
    activeDragCleanupRef.current = cleanup;
  };

  const renderNode = (node: ProfileNode): React.ReactNode => {
    const isSelected = selectedProfileKey === node.key;
    const hasPendingChanges = pendingProfiles[node.key];
    const hasSecureChanges = hasPendingSecureChanges(node.key);
    const isDefault = isProfileDefault(node.key);
    const hasRename = hasPendingRename(node.key);
    const rowHasPendingEdits = Boolean(hasPendingChanges) || hasSecureChanges || hasRename || hasPendingDefaultChange(node.key);
    const isDragging = draggedProfile === node.key;
    const isDragOver = dragOverProfile === node.key;
    const canDrop = draggedProfile && draggedProfile !== node.key && !isInvalidDrop(draggedProfile, node.key);
    const isCut = !!(
      profileClipboard &&
      profileClipboard.type === "cut" &&
      (node.key === profileClipboard.sourceKey || node.key.startsWith(profileClipboard.sourceKey + "."))
    );
    // Rendered as an actual (non-interactive) row under this node, at the exact spot and
    // indentation level a real one would occupy, rather than a floating label near the cursor.
    const previewChildKey = isDragOver && canDrop && draggedProfile ? computeDropResultKey(draggedProfile, node.key) : null;
    const previewChildName = previewChildKey?.split(".").pop() ?? null;
    const previewChildType = previewChildName && draggedProfile ? getProfileType(draggedProfile) : null;

    return (
      <div
        className="profile-tree-node"
        key={node.key}
        data-testid="profile-tree-node"
        data-profile-key={node.key}
        data-profile-name={node.name}
        data-profile-type={getProfileType(node.key)}
        data-profile-level={node.level}
        data-has-children={node.hasChildren}
        data-is-expanded={node.isExpanded}
        style={{ position: "relative" }}
      >
        <div
          className={`profile-tree-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""} ${isCut ? "is-cut" : ""}`}
          style={{
            cursor: "pointer",
            margin: "2px 0",
            padding: "6px 8px",
            paddingLeft: `${8 + node.level * 16}px`,
            borderRadius: "4px",
            border: isSelected ? "2px solid var(--vscode-button-background)" : "2px solid transparent",
            backgroundColor:
              isDragOver && canDrop
                ? "var(--vscode-button-hoverBackground)"
                : isDragging
                  ? "var(--vscode-button-secondaryHoverBackground)"
                  : "var(--vscode-input-background)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9em",
            opacity: isDragging || isCut ? 0.5 : 1,
            transition: "all 0.2s ease",
            userSelect: "none",
            minHeight: "28px",
          }}
          draggable={false}
          tabIndex={0}
          role="treeitem"
          aria-selected={isSelected}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              if (isSelected) {
                onProfileSelect("");
              } else {
                onProfileSelect(node.key);
              }
            } else if (node.hasChildren && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
              e.preventDefault();
              e.stopPropagation();
              const expand = e.key === "ArrowRight";
              if (node.isExpanded !== expand) {
                toggleNode(node.key);
              }
            }
          }}
          onMouseDown={(e) => handleRowMouseDown(e, node.key)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onProfileSelect(node.key);
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
            setContextMenu({ x, y, profileKey: node.key });
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false;
              return;
            }
            if (isSelected) {
              onProfileSelect("");
            } else {
              onProfileSelect(node.key);
            }
          }}
          title={node.key}
        >
          {/* Expand/collapse arrow */}
          {node.hasChildren && (
            <span
              className={`codicon profile-tree-chevron ${node.isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.key);
              }}
              title={node.isExpanded ? "Collapse" : "Expand"}
            />
          )}

          {/* Placeholder for consistent alignment when no arrow */}
          {!node.hasChildren && <span className="profile-tree-indent-spacer" draggable={false} />}

          {/* Profile name. Wrapper takes the flexible space so the badge/star group stays pinned
              right; the dot lives inside it, right after the (possibly truncated) name text, rather
              than being pushed all the way over next to the type badge. */}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflow: "hidden",
              pointerEvents: "none",
            }}
            draggable={false}
            data-testid="profile-name"
            data-profile-name={node.name}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
            {rowHasPendingEdits && (
              <span
                className="codicon codicon-circle-filled pending-change-indicator"
                title={l10n.t("Unsaved changes")}
                draggable={false}
                style={{ flexShrink: 0 }}
              />
            )}
          </span>

          {/* Default profile indicator */}
          <div className="config-editor-flex-gap-sm">
            {getProfileType(node.key) && (
              <ProfileTypeBadge
                profileType={getProfileType(node.key)!}
                isLightTheme={isLightTheme}
                filterActive={filterType === getProfileType(node.key)}
                onToggleFilter={() => {
                  const profileType = getProfileType(node.key);
                  if (profileType && onFilterChange) {
                    // If clicking on the same type that's already filtered, clear the filter
                    onFilterChange(filterType === profileType ? null : profileType);
                  }
                }}
              />
            )}
            {getProfileType(node.key) && (
              <DefaultStarButton
                variant="tree"
                profileKey={node.key}
                profileType={getProfileType(node.key)}
                isDefault={isDefault}
                configurations={configurations}
                selectedTab={selectedTab}
                setPendingDefaults={setPendingDefaults}
                onSetAsDefault={onSetAsDefault}
              />
            )}
          </div>
        </div>

        {/* Render children if expanded, with a vertical guide connecting them back to this row's
            toggle. Also renders (even if collapsed/childless) while this row is a valid drop
            target, purely to host the preview row below. */}
        {((node.isExpanded && node.children.length > 0) || previewChildName) && (
          <div className="profile-tree-children">
            <span className="profile-tree-indent-guide" style={{ left: `${8 + node.level * 16 + 6}px` }} />
            {node.isExpanded && node.children.map((child) => renderNode(child))}
            {previewChildName && (
              <div className="profile-tree-node" data-testid="profile-tree-drop-preview">
                <div
                  className="profile-tree-item profile-tree-drop-preview-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: "2px 0",
                    padding: "6px 8px",
                    paddingLeft: `${8 + (node.level + 1) * 16}px`,
                    borderRadius: "4px",
                    minHeight: "28px",
                    fontSize: "0.9em",
                  }}
                >
                  <span className="profile-tree-indent-spacer" />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewChildName}</span>
                  {previewChildType && (
                    <ProfileTypeBadge profileType={previewChildType} isLightTheme={isLightTheme} filterActive={false} onToggleFilter={() => {}} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const treeNodes = buildTree(profileKeys);
  const isDraggingRootProfile = draggedProfile && !draggedProfile.includes(".");

  // Root drop zone for moving profiles to root level
  const renderRootDropZone = () => {
    const isDragOverRoot = dragOverProfile === "ROOT";
    const canDropToRoot = draggedProfile && !isInvalidDrop(draggedProfile, "ROOT");
    const isDragging = draggedProfile !== null;

    return (
      <div
        data-profile-key="ROOT"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          margin: "2px 0",
          padding: isDragging ? "8px" : "4px",
          borderRadius: "4px",
          border: isDragOverRoot && canDropToRoot ? "2px dashed var(--vscode-button-background)" : "2px solid transparent",
          backgroundColor: isDragOverRoot && canDropToRoot ? "var(--vscode-button-hoverBackground)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isDragging ? "0.8em" : "0.7em",
          color: isDragging ? "var(--vscode-descriptionForeground)" : "var(--vscode-disabledForeground)",
          transition: "all 0.2s ease",
          minHeight: isDragging ? "32px" : "20px",
          opacity: isDragging ? 1 : 0.3,
          backdropFilter: "blur(4px)",
          boxShadow: isDragging ? "0 2px 8px rgba(0, 0, 0, 0.1)" : "none",
        }}
      >
        {isDragOverRoot && canDropToRoot
          ? `Move to root as "${
              draggedProfile
                ? resolveDropTargetKey({
                    proposedKey: draggedProfile.split(".").pop() || draggedProfile,
                    draggedProfile,
                    profileKeys,
                    pendingProfiles,
                    renames,
                    configurations,
                    selectedTab,
                    findOriginalKey,
                  })
                : ""
            }"`
          : isDragging
            ? "Drop zone for root level"
            : ""}
      </div>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="profile-tree profile-tree-scroll"
      data-testid="profile-tree"
      data-profile-count={profileKeys.length}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: "100%",
        width: "100%",
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
      {draggedProfile && !isDraggingRootProfile && renderRootDropZone()}
      {treeNodes.map((node) => renderNode(node))}
      <div
        className="profile-tree-empty-space"
        data-testid="profile-tree-empty-space"
        data-profile-key="ROOT"
        style={{
          flex: 1,
          minHeight: "120px",
          width: "100%",
          cursor: "default",
        }}
        onClick={() => onProfileSelect("")}
      />
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
