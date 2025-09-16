import React, { useState, useMemo } from "react";
import { getOriginalProfileKeyWithNested } from "../utils/profileUtils";

const MAX_RENAMES_PER_PROFILE = 3;

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
  renameCounts?: { [configPath: string]: { [profileKey: string]: number } };
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
  hasPendingSecureChanges,
  hasPendingRename,
  isFilteringActive,
  expandedNodes,
  setExpandedNodes,
  onProfileRename,
  configurations,
  selectedTab,
  renames,
  renameCounts,
}: ProfileTreeProps) {
  const hasNestedProfiles = profileKeys.some((key) => key.includes("."));

  // Drag and drop state
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);
  const [dragOverProfile, setDragOverProfile] = useState<string | null>(null);

  // Helper function to check if a profile has reached the rename limit
  const hasReachedRenameLimit = (profileKey: string): boolean => {
    if (!configurations || selectedTab === null || selectedTab === undefined || !renameCounts || !renames) {
      return false;
    }

    const configPath = configurations[selectedTab]?.configPath;
    if (!configPath || !renameCounts[configPath]) {
      return false;
    }

    // Get the original profile key to check rename limit
    const originalProfileKey = findOriginalKey(profileKey);
    const currentRenameCount = renameCounts[configPath][originalProfileKey] || 0;
    return currentRenameCount >= MAX_RENAMES_PER_PROFILE;
  };

  // Memoized helper function to check if a profile was renamed via the modal (not drag-drop)
  const hasModalRename = useMemo(() => {
    return (profileKey: string): boolean => {
      if (!configurations || selectedTab === null || selectedTab === undefined || !renameCounts || !renames) {
        return false;
      }

      const configPath = configurations[selectedTab]?.configPath;
      if (!configPath || !renameCounts[configPath]) {
        return false;
      }

      // Use the optimized utility function to find the original key
      const originalProfileKey = findOriginalKey(profileKey);
      const currentRenameCount = renameCounts[configPath][originalProfileKey] || 0;

      // If there's a rename count, it means this profile (or its original) was renamed via the modal
      // Drag-drop operations don't increment the rename count
      return currentRenameCount > 0;
    };
  }, [configurations, selectedTab, renameCounts, renames]);

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
  const hasComplexRenameChain = (profileKey: string): boolean => {
    if (!configurations || selectedTab === null || selectedTab === undefined || !renames) {
      return false;
    }

    const configPath = configurations[selectedTab]?.configPath;
    if (!configPath || !renames[configPath]) {
      return false;
    }

    const configRenames = renames[configPath];

    // Check if this profile is part of a complex rename chain
    // A complex chain is one where a profile has been renamed multiple times
    const originalKey = findOriginalKey(profileKey);

    // Count how many renames are in the chain
    let chainLength = 0;
    let currentKey = originalKey;
    const visited = new Set<string>();

    while (configRenames[currentKey] && !visited.has(currentKey)) {
      visited.add(currentKey);
      chainLength++;
      currentKey = configRenames[currentKey];

      // If we have more than 3 renames in the chain, consider it complex
      if (chainLength > 3) {
        return true;
      }
    }

    return false;
  };

  // Drag and drop handlers
  const handleDragStart = (e: any, profileKey: string) => {
    e.stopPropagation();

    // Prevent dragging if rename limit is reached
    if (hasReachedRenameLimit(profileKey)) {
      e.preventDefault();
      return;
    }

    // Prevent dragging if this would create a complex rename chain
    if (hasComplexRenameChain(profileKey)) {
      e.preventDefault();
      // Log error and prevent drag to avoid performance issues
      console.error(
        "Cannot drag this profile: Complex rename chains are not supported to prevent performance issues. Please save your changes and refresh to reset the profile structure."
      );
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", profileKey);
      e.dataTransfer.setData("application/json", JSON.stringify({ profileKey }));

      // Set a custom drag image to make it more obvious
      const dragImage = e.target.cloneNode(true);
      dragImage.style.opacity = "0.5";
      e.dataTransfer.setDragImage(dragImage, 0, 0);
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

    // Check if this drop would create a complex rename chain
    try {
      const originalKey = findOriginalKey(draggedProfile);
      const configPath = configurations?.[selectedTab!]?.configPath;

      if (configPath && renames?.[configPath]) {
        const configRenames = renames[configPath];
        let chainLength = 0;
        let currentKey = originalKey;
        const visited = new Set<string>();

        while (configRenames[currentKey] && !visited.has(currentKey)) {
          visited.add(currentKey);
          chainLength++;
          currentKey = configRenames[currentKey];

          // If we have more than 3 renames in the chain, prevent the drop
          if (chainLength > 3) {
            setDraggedProfile(null);
            setDragOverProfile(null);
            console.error(
              "Cannot complete this drag operation: Complex rename chains are not supported to prevent performance issues. Please save your changes and refresh to reset the profile structure."
            );
            return;
          }
        }
      }
    } catch (error) {
      // If there's any error during the check, clear the drag state and show error
      setDraggedProfile(null);
      setDragOverProfile(null);
      console.error("Drag operation failed due to complex profile structure. Please save your changes and refresh to reset the profile structure.");
      return;
    }

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
      <div className="profile-tree-node" key={node.key}>
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
                : "var(--vscode-button-secondaryBackground)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9em",
            opacity: isDragging ? 0.5 : 1,
            transition: "all 0.2s ease",
            userSelect: "none",
          }}
          draggable={!hasReachedRenameLimit(node.key) && !hasModalRename(node.key)}
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
          >
            {node.name}
          </span>

          {/* Default profile indicator */}
          {isDefault && (
            <span
              className="codicon codicon-star-full"
              style={{
                fontSize: "12px",
                color: "var(--vscode-textPreformat-foreground)",
                flexShrink: 0,
                pointerEvents: "none",
              }}
              draggable={false}
              title="Default profile"
            />
          )}
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
    <div style={{ width: "100%" }} className="profile-tree">
      {draggedProfile && !isDraggingRootProfile && renderRootDropZone()}
      {treeNodes.map((node) => renderNode(node))}
    </div>
  );
}
