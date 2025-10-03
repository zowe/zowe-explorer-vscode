import { useState, useEffect, useRef } from "react";
import { ProfileSearchFilter } from "./ProfileSearchFilter";
import { ProfileTree } from "./ProfileTree";

// Color map for profile types
const profileTypeColorMap = new Map<string, string>();
const availableColors = new Set<string>();

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
PROFILE_TYPE_COLORS.forEach((color) => {
  if (!coreColors.has(color)) {
    availableColors.add(color);
  }
});

PROFILE_TYPE_COLORS.forEach((color) => availableColors.add(color));

export const getColorForProfileType = (profileType: string): string => {
  // Check if it's a core type first
  if (coreTypeColors[profileType]) {
    return coreTypeColors[profileType];
  }

  if (!profileTypeColorMap.has(profileType)) {
    // If we've run out of colors, reset the available pool
    if (availableColors.size === 0) {
      PROFILE_TYPE_COLORS.forEach((color) => {
        if (!coreColors.has(color)) {
          availableColors.add(color);
        }
      });
    }

    // Pick a random color from available colors
    const availableArray = Array.from(availableColors);
    const randomIndex = Math.floor(Math.random() * availableArray.length);
    const color = availableArray[randomIndex];

    profileTypeColorMap.set(profileType, color);
    availableColors.delete(color);
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
                backgroundColor: "var(--vscode-input-background)",
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
                            const profileType = getProfileType(profileKey);
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
                            const profileType = getProfileType(profileKey);
                            const bgColor = getColorForProfileType(profileType!);

                            // For dark theme, lighten or darken the text color based on the original color's brightness
                            const adjustColorForDarkTheme = (color: string) => {
                              const hex = color.replace("#", "");
                              const r = parseInt(hex.substr(0, 2), 16);
                              const g = parseInt(hex.substr(2, 2), 16);
                              const b = parseInt(hex.substr(4, 2), 16);

                              // Calculate relative luminance
                              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

                              // If color is too bright, darken it; if too dark, lighten it
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
                              // Medium colors are fine as-is
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
                      filterType === getProfileType(profileKey)
                        ? `Click to clear ${getProfileType(profileKey)} filter`
                        : `Click to filter by ${getProfileType(profileKey)} type`
                    }
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
