import { useState, useEffect } from "react";
import { ProfileSearchFilter } from "./ProfileSearchFilter";

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
}

export function ProfileList({
  sortedProfileKeys,
  selectedProfileKey,
  pendingProfiles,
  onProfileSelect,
  isProfileDefault,
  getProfileType,
}: ProfileListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filteredProfileKeys, setFilteredProfileKeys] = useState<string[]>(sortedProfileKeys);

  // Get unique profile types for filter dropdown
  const availableTypes = Array.from(
    new Set(sortedProfileKeys.map((key) => getProfileType(key)).filter((type): type is string => type !== null))
  ).sort();

  // Filter profiles based on search term and type filter
  useEffect(() => {
    let filtered = sortedProfileKeys;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((profileKey) => profileKey.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter((profileKey) => getProfileType(profileKey) === filterType);
    }

    setFilteredProfileKeys(filtered);
  }, [sortedProfileKeys, searchTerm, filterType, getProfileType]);

  return (
    <div
      style={{
        width: "250px",
        paddingRight: "1rem",
        minHeight: "400px",
        maxHeight: "400px",
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Search and Filter Component - Sticky */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--vscode-editor-background)",
          zIndex: 10,
          paddingBottom: "8px",
          borderBottom: "1px solid var(--vscode-tab-border)",
        }}
      >
        <ProfileSearchFilter onSearchChange={setSearchTerm} onFilterChange={setFilterType} availableTypes={availableTypes} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredProfileKeys.map((profileKey) => (
          <div
            key={profileKey}
            className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""}`}
            style={{
              cursor: "pointer",
              margin: "8px 0",
              padding: "8px",
              borderRadius: "4px",
              border: selectedProfileKey === profileKey ? "2px solid var(--vscode-button-background)" : "2px solid transparent",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              position: "relative",
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
            <strong
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: pendingProfiles[profileKey] ? 0.7 : 1,
              }}
            >
              {profileKey}
              {isProfileDefault(profileKey) && (
                <span
                  className="codicon codicon-star-full"
                  style={{
                    marginLeft: "4px",
                    fontSize: "12px",
                    color: "var(--vscode-textPreformat-foreground)",
                  }}
                  title="Default profile"
                />
              )}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
