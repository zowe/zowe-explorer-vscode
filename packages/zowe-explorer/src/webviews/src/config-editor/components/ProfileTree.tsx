import React, { useState, useMemo, useRef, useEffect } from "react";
import { getOriginalProfileKeyWithNested } from "../utils/profileUtils";
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

      if (targetKey && !isInvalidDrop(profileKey, targetKey)) {
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
      document.body.style.cursor = "";
      ghost?.remove();
      ghost = null;
      activeDragCleanupRef.current = null;
    };

    const onMouseUp = () => {
      if (moved) {
        suppressNextClickRef.current = true;
        if (lastHoverTarget) {
          performDrop(profileKey, lastHoverTarget);
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

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    activeDragCleanupRef.current = cleanup;
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
        style={{ position: "relative" }}
      >
        <div
          className={`profile-tree-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""} ${
            hasPendingChanges || hasSecureChanges || hasRename ? "profile-tree-item--pending" : ""
          }`}
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
          draggable={false}
          onMouseDown={(e) => handleRowMouseDown(e, node.key)}
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
    <div ref={scrollContainerRef} className="profile-tree profile-tree-scroll" data-testid="profile-tree" data-profile-count={profileKeys.length}>
      {draggedProfile && !isDraggingRootProfile && renderRootDropZone()}
      {treeNodes.map((node) => renderNode(node))}
    </div>
  );
}
