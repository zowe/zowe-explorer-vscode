import { useState, useEffect } from "react";
import { ProfileSearchFilter } from "./ProfileSearchFilter";
import { ProfileTree } from "./ProfileTree";

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
  // Search and filter props
  searchTerm: string;
  filterType: string | null;
  onSearchChange: (searchTerm: string) => void;
  onFilterChange: (filterType: string | null) => void;
}

export function ProfileList({
  sortedProfileKeys,
  selectedProfileKey,
  pendingProfiles,
  onProfileSelect,
  isProfileDefault,
  getProfileType,
  viewMode,
  hasPendingSecureChanges,
  searchTerm,
  filterType,
  onSearchChange,
  onFilterChange,
}: ProfileListProps) {
  const [filteredProfileKeys, setFilteredProfileKeys] = useState<string[]>(sortedProfileKeys);
  const [isFilteringActive, setIsFilteringActive] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Get unique profile types for filter dropdown
  const availableTypes = Array.from(
    new Set(sortedProfileKeys.map((key) => getProfileType(key)).filter((type): type is string => type !== null))
  ).sort();

  // Filter profiles based on search term and type filter
  useEffect(() => {
    let filtered = sortedProfileKeys;
    let isFiltering = false;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((profileKey) => profileKey.toLowerCase().includes(searchTerm.toLowerCase()));
      isFiltering = true;
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter((profileKey) => getProfileType(profileKey) === filterType);
      isFiltering = true;
    }

    // For tree view, expand filtered results to include parent profiles of matching children
    if (viewMode === "tree") {
      filtered = expandFilteredResultsForTree(filtered, sortedProfileKeys);
    }

    setFilteredProfileKeys(filtered);
    setIsFilteringActive(isFiltering);
  }, [sortedProfileKeys, searchTerm, filterType, getProfileType, viewMode]);

  // Auto-expand parent nodes of selected profile to ensure it's visible
  useEffect(() => {
    if (viewMode === "tree" && selectedProfileKey) {
      const newExpandedNodes = new Set(expandedNodes);
      const parts = selectedProfileKey.split(".");

      // Add all parent nodes of the selected profile
      for (let i = 1; i < parts.length; i++) {
        const parentKey = parts.slice(0, i).join(".");
        if (sortedProfileKeys.includes(parentKey)) {
          newExpandedNodes.add(parentKey);
        }
      }

      setExpandedNodes(newExpandedNodes);
    }
  }, [selectedProfileKey, viewMode, sortedProfileKeys]);

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
        maxHeight: "calc(100vh - 200px)",
        overflow: "hidden",
      }}
    >
      {/* Search and Filter Component - Sticky */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--vscode-editor-background)",
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
        />
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {viewMode === "tree" ? (
          <ProfileTree
            profileKeys={filteredProfileKeys}
            selectedProfileKey={selectedProfileKey}
            pendingProfiles={pendingProfiles}
            onProfileSelect={onProfileSelect}
            isProfileDefault={isProfileDefault}
            getProfileType={getProfileType}
            hasPendingSecureChanges={hasPendingSecureChanges}
            isFilteringActive={isFilteringActive}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
          />
        ) : (
          filteredProfileKeys.map((profileKey) => (
            <div
              key={profileKey}
              className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""}`}
              style={{
                cursor: "pointer",
                margin: "2px 0",
                padding: "6px 8px",
                borderRadius: "4px",
                border: selectedProfileKey === profileKey ? "2px solid var(--vscode-button-background)" : "2px solid transparent",
                backgroundColor: "var(--vscode-button-secondaryBackground)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.9em",
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
            >
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  opacity: pendingProfiles[profileKey] || hasPendingSecureChanges(profileKey) ? 0.7 : 1,
                }}
              >
                {profileKey}
              </span>
              {isProfileDefault(profileKey) && (
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
          ))
        )}
      </div>
    </div>
  );
}
