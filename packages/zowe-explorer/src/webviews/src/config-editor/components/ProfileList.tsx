import { useState, useEffect } from "react";
import { ProfileSearchFilter } from "./ProfileSearchFilter";
import { ProfileTree } from "./ProfileTree";

// Color map for profile types
const PROFILE_TYPE_COLORS: { [key: string]: string } = {
  zosmf: "#4A90E2",
  tso: "#7ED321",
  ssh: "#F5A623",
  ca7: "#BD10E0",
  caspool: "#50E3C2",
  caview: "#B8E986",
  cics: "#4A90E2",
  db2: "#7ED321",
  ebg: "#F5A623",
  endevor: "#BD10E0",
  "endevor-location": "#50E3C2",
  fmp: "#B8E986",
  idms: "#4A90E2",
  ims: "#7ED321",
  jclcheck: "#F5A623",
  mat: "#BD10E0",
  pma: "#50E3C2",
  mq: "#B8E986",
  ops: "#4A90E2",
  sysview: "#7ED321",
  "sysview-format": "#F5A623",
  zftp: "#BD10E0",
  base: "#50E3C2",
};

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
    new Set(sortedProfileKeys.map((key) => getProfileType(key)).filter((type): type is string => type !== null))
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
        maxHeight: "calc(100vh - 200px)",
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
                  opacity: pendingProfiles[profileKey] || hasPendingSecureChanges(profileKey) || hasPendingRename(profileKey) ? 0.7 : 1,
                }}
                data-testid="profile-name"
                data-profile-name={profileKey}
              >
                {profileKey}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                {getProfileType(profileKey) && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      const profileType = getProfileType(profileKey);
                      if (profileType) {
                        onFilterChange(profileType);
                      }
                    }}
                    style={{
                      fontSize: "11px",
                      color: PROFILE_TYPE_COLORS[getProfileType(profileKey)!] || "var(--vscode-button-secondaryForeground)",
                      backgroundColor: PROFILE_TYPE_COLORS[getProfileType(profileKey)!]
                        ? `${PROFILE_TYPE_COLORS[getProfileType(profileKey)!]}20`
                        : "var(--vscode-badge-background)",
                      border: `1px solid ${PROFILE_TYPE_COLORS[getProfileType(profileKey)!] || "var(--vscode-button-secondaryForeground)"}`,
                      padding: "2px 6px",
                      borderRadius: "10px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      cursor: "pointer",
                      transition: "opacity 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: "1",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    title={`Click to filter by ${getProfileType(profileKey)} type`}
                  >
                    {getProfileType(profileKey)}
                  </span>
                )}
                {getProfileType(profileKey) && (
                  <button
                    className="profile-star-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const profileType = getProfileType(profileKey);
                      if (!profileType) return; // Don't allow interaction if no type

                      if (isProfileDefault(profileKey)) {
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
                      } else {
                        // Set as default
                        onSetAsDefault(profileKey);
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
                    title={isProfileDefault(profileKey) ? "Click to remove default" : "Set as default"}
                  >
                    <span
                      className={`codicon codicon-${isProfileDefault(profileKey) ? "star-full" : "star-empty"}`}
                      style={{
                        fontSize: "14px",
                        color: isProfileDefault(profileKey) ? "var(--vscode-textPreformat-foreground)" : "var(--vscode-disabledForeground)",
                      }}
                    />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
