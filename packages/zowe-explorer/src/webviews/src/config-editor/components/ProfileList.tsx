import { useState, useEffect } from "react";
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
  onSetAsDefault,
  isProfileDefault,
  getProfileType,
  viewMode,
  hasPendingSecureChanges,
  hasPendingRename,
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
          profileSortOrder={profileSortOrder}
          onProfileSortOrderChange={handleProfileSortOrderChange}
        />
      </div>
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {viewMode === "tree" ? (
          <ProfileTree
            profileKeys={filteredProfileKeys}
            selectedProfileKey={selectedProfileKey}
            pendingProfiles={pendingProfiles}
            onProfileSelect={onProfileSelect}
            isProfileDefault={isProfileDefault}
            getProfileType={getProfileType}
            hasPendingSecureChanges={hasPendingSecureChanges}
            hasPendingRename={hasPendingRename}
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
          filteredProfileKeys.map((profileKey) => {
            const rowHasPendingEdits = Boolean(pendingProfiles[profileKey]) || hasPendingSecureChanges(profileKey) || hasPendingRename(profileKey);
            return (
              <div
                key={profileKey}
                className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""} ${
                  rowHasPendingEdits ? "profile-list-item--pending" : ""
                }`}
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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    opacity: rowHasPendingEdits ? 0.7 : 1,
                  }}
                  data-testid="profile-name"
                  data-profile-name={profileKey}
                >
                  {profileKey}
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
          })
        )}
      </div>
    </div>
  );
}
