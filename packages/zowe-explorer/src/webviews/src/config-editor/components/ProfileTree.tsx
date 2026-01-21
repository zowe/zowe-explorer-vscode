import React, { useState, useMemo, useEffect, useRef } from "react";
import { getOriginalProfileKeyWithNested } from "../utils/profileUtils";

// Color map for profile types
const profileTypeColorMap = new Map<string, string>();

export const PROFILE_TYPE_COLORS: string[] = [
  "#810D49",
  "#00735C",
  "#AB0D61",
  "#009175",
  "#D80D7B",
  "#00CBA7",
  "#FF78AD",
  "#00EBC1",
  "#00489E",
  "#8E06CD",
  "#0079FA",
  "#ED0DFD",
  "#00C2F9",
  "#86081C",
  "#B20725",
  "#DE0D2E",
  "#FF4235",
  "#FF8735",
  "#00F407",
  "#FFB935",
  "#AFFF2A",
];

export const coreTypeColors: { [key: string]: string } = {
  zosmf: "#DE0D2E",
  tso: "#00F407",
  ssh: "#FF8735",
  base: "#0079FA",
};

export const coreColors = new Set(Object.values(coreTypeColors));

// Get available colors (non-core colors) as a sorted array for deterministic selection
const getAvailableColors = (): string[] => {
  return PROFILE_TYPE_COLORS.filter((color) => !coreColors.has(color)).sort();
};

// Simple hash function to convert string to number deterministically
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

export const getColorForProfileType = (profileType: string): string => {
  // Check if it's a core type first
  if (coreTypeColors[profileType]) {
    return coreTypeColors[profileType];
  }

  if (!profileTypeColorMap.has(profileType)) {
    // Get available colors (non-core colors)
    const availableColors = getAvailableColors();
    // Use hash of profile type to deterministically select a color
    const hash = hashString(profileType);
    const colorIndex = hash % availableColors.length;
    const color = availableColors[colorIndex];

    profileTypeColorMap.set(profileType, color);
  }
  return profileTypeColorMap.get(profileType)!;
};

export function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState("vscode-light" === document.body.getAttribute("data-vscode-theme-kind"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newIsLight = "vscode-light" === document.body.getAttribute("data-vscode-theme-kind");
      setIsLight(newIsLight);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-vscode-theme-kind"],
    });

    return () => observer.disconnect();
  }, []);

  return isLight;
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
  isFilteringActive?: boolean;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  onProfileRename?: (originalKey: string, newKey: string, isDragDrop?: boolean) => boolean;
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
  isFilteringActive,
  expandedNodes,
  setExpandedNodes,
  onProfileRename,
  configurations,
  selectedTab,
  renames,
  onSetAsDefault,
  setPendingDefaults,
  onFilterChange,
  filterType,
}: ProfileTreeProps) {
  const hasNestedProfiles = profileKeys.some((key) => key.includes("."));

  // Drag and drop state
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);
  const [dragOverProfile, setDragOverProfile] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

      // Use the optimized utility function instead of recreating the entire profile tree
      return getOriginalProfileKeyWithNested(currentKey, configPath, renames);
    };
  }, [configurations, selectedTab, renames]);

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

  useEffect(() => {
    if (selectedProfileKey && scrollContainerRef.current) {
      const scrollToSelected = () => {
        const selectedElement = scrollContainerRef.current?.querySelector(`[data-profile-key="${selectedProfileKey}"]`);
        if (selectedElement && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const containerRect = container.getBoundingClientRect();
          const elementRect = selectedElement.getBoundingClientRect();

          const isElementVisible = elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;

          if (!isElementVisible || elementRect.top < containerRect.top + 50 || elementRect.bottom > containerRect.bottom - 50) {
            selectedElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
            return true;
          }
        }
        return false;
      };

      if (!scrollToSelected()) {
        const timeouts = [
          setTimeout(() => scrollToSelected(), 100),
          setTimeout(() => scrollToSelected(), 300),
          setTimeout(() => scrollToSelected(), 500),
        ];

        return () => timeouts.forEach(clearTimeout);
      }
    }
  }, [selectedProfileKey]);

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

  // Drag and drop handlers
  const handleDragStart = (e: any, profileKey: string) => {
    e.stopPropagation();

    // Drag is now always allowed - restrictions are handled in the drop handler

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", profileKey);
      e.dataTransfer.setData("application/json", JSON.stringify({ profileKey }));

      const dragImage = e.target.cloneNode(true);
      dragImage.style.opacity = "0.5";

      // Calculate the offset based on mouse position within the element
      const rect = e.target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      // Ensure the offset is within reasonable bounds
      const clampedOffsetX = Math.max(0, Math.min(offsetX, rect.width));
      const clampedOffsetY = Math.max(0, Math.min(offsetY, rect.height));

      e.dataTransfer.setDragImage(dragImage, clampedOffsetX, clampedOffsetY);
    }

    // Use setTimeout to ensure the drag operation starts before setting state
    setTimeout(() => {
      setDraggedProfile(profileKey);
    }, 0);
  };

  const handleDragOver = (e: any, profileKey: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    // Only allow dropping if it's a valid target
    if (draggedProfile && draggedProfile !== profileKey && !isInvalidDrop(draggedProfile, profileKey)) {
      setDragOverProfile(profileKey);
    }
  };

  const handleDragLeave = (e: any) => {
    // Only clear drag over if we're leaving the profile item itself
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverProfile(null);
    }
  };

  const handleDrop = (e: any, targetProfileKey: string) => {
    e.preventDefault();

    if (!draggedProfile || !onProfileRename) {
      setDraggedProfile(null);
      setDragOverProfile(null);
      return;
    }

    // Validate the drop
    if (isInvalidDrop(draggedProfile, targetProfileKey)) {
      setDraggedProfile(null);
      setDragOverProfile(null);
      return;
    }

    // The drag-drop restrictions are now handled in the profile handlers

    // Extract only the profile name (last part) from the dragged profile
    const draggedProfileName = draggedProfile.split(".").pop() || draggedProfile;

    // Determine the new profile key
    let newProfileKey: string;

    // Special case: if dragging back to the original location, just move to that location
    if (draggedProfile === targetProfileKey) {
      newProfileKey = targetProfileKey;
    } else if (draggedProfile === `${targetProfileKey}.${draggedProfileName}`) {
      // Special case: if dragging a nested profile back to its parent, move to the parent
      newProfileKey = targetProfileKey;
    } else if (targetProfileKey === draggedProfileName) {
      // Special case: if dragging a nested profile to a root profile with the same name, move to root
      newProfileKey = targetProfileKey;
    } else if (targetProfileKey.endsWith(`.${draggedProfileName}`)) {
      // Special case: if dragging to a profile that ends with the same name, move to that location
      // This handles cases like bonk.tso.help -> bonk.help
      newProfileKey = targetProfileKey;
    } else {
      // Create the new nested profile structure
      newProfileKey = `${targetProfileKey}.${draggedProfileName}`;
    }

    // Check if the new profile key would conflict with an existing profile
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
    if (allCurrentProfileKeys.includes(newProfileKey) && newProfileKey !== draggedProfile) {
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
      if (!namesInRenameChain.has(newProfileKey)) {
        // Find a unique name by appending a number
        let counter = 1;
        let uniqueNewProfileKey = `${newProfileKey}_${counter}`;

        while (allCurrentProfileKeys.includes(uniqueNewProfileKey)) {
          counter++;
          uniqueNewProfileKey = `${newProfileKey}_${counter}`;
        }

        newProfileKey = uniqueNewProfileKey;
      }
    }

    // Only call rename if the key actually changes
    if (draggedProfile !== newProfileKey) {
      // Find the original key for the dragged profile
      const originalKey = findOriginalKey(draggedProfile);
      const success = onProfileRename(originalKey, newProfileKey, true); // true indicates this is a drag-drop operation

      // If the rename failed (e.g., due to circular rename), don't clear drag state
      // This allows the user to try again or cancel the drag operation
      if (!success) {
        return; // Don't clear drag state, let user try again
      }
    }

    // Clear drag state only on successful rename
    setDraggedProfile(null);
    setDragOverProfile(null);
  };

  const handleDragEnd = () => {
    setDraggedProfile(null);
    setDragOverProfile(null);
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

  const renderNode = (node: ProfileNode): React.ReactNode => {
    const isSelected = selectedProfileKey === node.key;
    const hasPendingChanges = pendingProfiles[node.key];
    const hasSecureChanges = hasPendingSecureChanges(node.key);
    const isDefault = isProfileDefault(node.key);
    const hasRename = hasPendingRename(node.key);
    const isDragging = draggedProfile === node.key;
    const isDragOver = dragOverProfile === node.key;
    const canDrop = draggedProfile && draggedProfile !== node.key && !isInvalidDrop(draggedProfile, node.key);

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
      >
        <div
          className={`profile-tree-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
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
            opacity: isDragging ? 0.5 : 1,
            transition: "all 0.2s ease",
            userSelect: "none",
            minHeight: "28px",
          }}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, node.key)}
          onDragOver={(e) => handleDragOver(e, node.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.key)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            e.stopPropagation();
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
              className={`codicon ${node.isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
              style={{
                fontSize: "12px",
                color: "var(--vscode-foreground)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.key);
              }}
              title={node.isExpanded ? "Collapse" : "Expand"}
            />
          )}

          {/* Placeholder for consistent alignment when no arrow */}
          {!node.hasChildren && <span style={{ width: "12px", flexShrink: 0 }} draggable={false} />}

          {/* Profile name */}
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: hasPendingChanges || hasSecureChanges || hasRename ? 0.7 : 1,
              pointerEvents: "none",
            }}
            draggable={false}
            data-testid="profile-name"
            data-profile-name={node.name}
          >
            {node.name}
          </span>

          {/* Default profile indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {getProfileType(node.key) && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  const profileType = getProfileType(node.key);
                  if (profileType && onFilterChange) {
                    // If clicking on the same type that's already filtered, clear the filter
                    if (filterType === profileType) {
                      onFilterChange(null);
                    } else {
                      onFilterChange(profileType);
                    }
                  }
                }}
                style={
                  useIsLightTheme()
                    ? (() => {
                        const profileType = getProfileType(node.key);
                        const bgColor = getColorForProfileType(profileType!);

                        // Determine text color based on background luminance
                        const getTextColor = (hex: string): string => {
                          const cleanHex = hex.replace("#", "");
                          const r = parseInt(cleanHex.substring(0, 2), 16);
                          const g = parseInt(cleanHex.substring(2, 4), 16);
                          const b = parseInt(cleanHex.substring(4, 6), 16);

                          // Convert to 0-1 range and apply gamma correction
                          const rsRGB = r / 255;
                          const gsRGB = g / 255;
                          const bsRGB = b / 255;

                          const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
                          const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
                          const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

                          // Calculate relative luminance
                          const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

                          return luminance <= 0.22 ? "white" : "black";
                        };

                        return {
                          fontSize: "11px",
                          color: getTextColor(bgColor),
                          backgroundColor: bgColor,
                          border: `1px solid ${bgColor}`,
                          padding: "2px 6px",
                          borderRadius: "10px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          cursor: "pointer",
                          transition: "opacity 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: "1",
                        };
                      })()
                    : (() => {
                        const profileType = getProfileType(node.key);
                        const bgColor = getColorForProfileType(profileType!);

                        // For dark theme, lighten or darken the text color based on the original color's brightness
                        const adjustColorForDarkTheme = (color: string) => {
                          const hex = color.replace("#", "");
                          const r = parseInt(hex.substr(0, 2), 16);
                          const g = parseInt(hex.substr(2, 2), 16);
                          const b = parseInt(hex.substr(4, 2), 16);

                          // Calculate relative luminance
                          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

                          if (luminance > 0.7) {
                            // Darken bright colors by 30%
                            return `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`;
                          } else if (luminance < 0.3) {
                            // Lighten dark colors by adding 40%
                            return `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.4))}, ${Math.min(
                              255,
                              Math.round(g + (255 - g) * 0.4)
                            )}, ${Math.min(255, Math.round(b + (255 - b) * 0.4))})`;
                          }
                          return color;
                        };

                        const textColor = adjustColorForDarkTheme(bgColor);

                        return {
                          fontSize: "12px",
                          color: textColor,
                          backgroundColor: `${bgColor}22`,
                          border: `1px solid ${bgColor}66`,
                          padding: "0 7px",
                          borderRadius: "2em",
                          fontWeight: "500",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          cursor: "pointer",
                          transition: "background-color 0.2s ease, border-color 0.2s ease",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: "20px",
                          height: "22px",
                        };
                      })()
                }
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
                title={
                  filterType === getProfileType(node.key)
                    ? `Click to clear ${getProfileType(node.key)} filter`
                    : `Click to filter by ${getProfileType(node.key)} type`
                }
              >
                {getProfileType(node.key)}
              </span>
            )}
            {getProfileType(node.key) && (
              <button
                className="profile-star-button"
                onClick={(e) => {
                  e.stopPropagation();
                  const profileType = getProfileType(node.key);
                  if (!profileType) return; // Don't allow interaction if no type

                  if (isDefault) {
                    // If already default, deselect it by setting to empty
                    if (profileType && setPendingDefaults && configurations && selectedTab !== null && selectedTab !== undefined) {
                      const configPath = configurations[selectedTab]!.configPath;
                      setPendingDefaults((prev) => ({
                        ...prev,
                        [configPath]: {
                          ...prev[configPath],
                          [profileType]: { value: "", path: [profileType] },
                        },
                      }));
                    }
                  } else if (onSetAsDefault) {
                    // Set as default
                    onSetAsDefault(node.key);
                  }
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
                draggable={false}
                title={isDefault ? "Click to remove default" : "Set as default"}
              >
                <span
                  className={`codicon codicon-${isDefault ? "star-full" : "star-empty"}`}
                  style={{
                    fontSize: "16px",
                    color: isDefault ? "var(--vscode-textPreformat-foreground)" : "var(--vscode-disabledForeground)",
                    pointerEvents: "none",
                  }}
                />
              </button>
            )}
          </div>
        </div>

        {/* Render children if expanded */}
        {node.isExpanded && node.children.length > 0 && <div>{node.children.map((child) => renderNode(child))}</div>}
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
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          if (draggedProfile && !isInvalidDrop(draggedProfile, "ROOT")) {
            setDragOverProfile("ROOT");
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverProfile(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!draggedProfile || !onProfileRename) {
            setDraggedProfile(null);
            setDragOverProfile(null);
            return;
          }

          // Validate the drop
          if (isInvalidDrop(draggedProfile, "ROOT")) {
            setDraggedProfile(null);
            setDragOverProfile(null);
            return;
          }

          // Extract only the profile name (last part) from the dragged profile
          const draggedProfileName = draggedProfile.split(".").pop() || draggedProfile;

          // Check if the new profile key would conflict with an existing profile
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
          let newProfileKey = draggedProfileName;
          if (allCurrentProfileKeys.includes(newProfileKey) && newProfileKey !== draggedProfile) {
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
            if (!namesInRenameChain.has(newProfileKey)) {
              // Find a unique name by appending a number
              let counter = 1;
              let uniqueNewProfileKey = `${newProfileKey}_${counter}`;

              while (allCurrentProfileKeys.includes(uniqueNewProfileKey)) {
                counter++;
                uniqueNewProfileKey = `${newProfileKey}_${counter}`;
              }

              newProfileKey = uniqueNewProfileKey;
            }
          }

          // Call the rename handler to move to root
          const originalKey = findOriginalKey(draggedProfile);
          onProfileRename(originalKey, newProfileKey, true); // true indicates this is a drag-drop operation

          // Clear drag state
          setDraggedProfile(null);
          setDragOverProfile(null);
        }}
      >
        {isDragOverRoot && canDropToRoot ? "Drop here to move to root level" : isDragging ? "Drop zone for root level" : ""}
      </div>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      style={{ width: "100%" }}
      className="profile-tree"
      data-testid="profile-tree"
      data-profile-count={profileKeys.length}
    >
      {draggedProfile && !isDraggingRootProfile && renderRootDropZone()}
      {treeNodes.map((node) => renderNode(node))}
    </div>
  );
}
