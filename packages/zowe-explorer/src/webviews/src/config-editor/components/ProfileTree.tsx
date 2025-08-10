import { useState } from "react";

interface ProfileTreeProps {
  profileKeys: string[];
  selectedProfileKey: string | null;
  pendingProfiles: { [key: string]: any };
  onProfileSelect: (profileKey: string) => void;
  isProfileDefault: (profileKey: string) => boolean;
  getProfileType: (profileKey: string) => string | null;
  hasPendingSecureChanges: (profileKey: string) => boolean;
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
}: ProfileTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build the tree structure from flat profile keys
  const buildTree = (keys: string[]): ProfileNode[] => {
    const nodes: ProfileNode[] = [];
    const nodeMap = new Map<string, ProfileNode>();

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
        isExpanded: expandedNodes.has(key),
      };

      nodeMap.set(key, node);

      // Add to root level if it's a top-level profile
      if (level === 0) {
        nodes.push(node);
      }
    });

    // Second pass: build parent-child relationships
    keys.forEach((key) => {
      const node = nodeMap.get(key);
      if (!node) return;

      const parts = key.split(".");
      if (parts.length > 1) {
        // This is a nested profile, find its parent
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

  const renderNode = (node: ProfileNode): React.ReactNode => {
    const isSelected = selectedProfileKey === node.key;
    const hasPendingChanges = pendingProfiles[node.key];
    const hasSecureChanges = hasPendingSecureChanges(node.key);
    const isDefault = isProfileDefault(node.key);

    return (
      <div key={node.key}>
        <div
          className={`profile-tree-item ${isSelected ? "selected" : ""}`}
          style={{
            cursor: "pointer",
            margin: "2px 0",
            padding: "6px 8px",
            paddingLeft: `${8 + node.level * 16}px`,
            borderRadius: "4px",
            border: isSelected ? "2px solid var(--vscode-button-background)" : "2px solid transparent",
            backgroundColor: "var(--vscode-button-secondaryBackground)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9em",
          }}
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
          {!node.hasChildren && <span style={{ width: "12px", flexShrink: 0 }} />}

          {/* Profile name */}
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: hasPendingChanges || hasSecureChanges ? 0.7 : 1,
            }}
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
              }}
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

  return <div style={{ width: "100%" }}>{treeNodes.map((node) => renderNode(node))}</div>;
}
