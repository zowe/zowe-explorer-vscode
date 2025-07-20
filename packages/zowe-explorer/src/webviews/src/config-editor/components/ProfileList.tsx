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
}

export function ProfileList({
  sortedProfileKeys,
  selectedProfileKey,
  pendingProfiles,
  profileMenuOpen,
  configPath,
  vscodeApi,
  onProfileSelect,
  onProfileMenuToggle,
  onDeleteProfile,
  onSetAsDefault,
  isProfileDefault,
}: ProfileListProps) {
  const handlePreviewArgs = (profileKey: string) => {
    vscodeApi.postMessage({
      command: "PREVIEW_ARGS",
      profilePath: profileKey,
      configPath: configPath,
    });
  };

  return (
    <div
      style={{
        width: "250px",
        paddingRight: "1rem",
        maxHeight: "400px",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {sortedProfileKeys.map((profileKey) => (
        <div
          key={profileKey}
          className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""}`}
          style={{
            cursor: "pointer",
            margin: "8px 0",
            padding: "8px",
            borderRadius: "4px",
            border: "2px solid var(--vscode-button-background)",
            backgroundColor: selectedProfileKey === profileKey ? "var(--vscode-button-hoverBackground)" : "transparent",
            position: "relative",
          }}
          onClick={() => onProfileSelect(profileKey)}
          title={profileKey}
        >
          <strong
            style={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: "24px",
              opacity: pendingProfiles[profileKey] ? 0.7 : 1,
            }}
          >
            {profileKey}
            {isProfileDefault(profileKey) && (
              <span
                className="codicon codicon-star"
                style={{
                  marginLeft: "4px",
                  fontSize: "12px",
                  color: "var(--vscode-textPreformat-foreground)",
                }}
                title="Default profile"
              />
            )}
          </strong>

          <button
            className="action-button"
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              padding: "2px",
              height: "20px",
              width: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              color: "var(--vscode-button-secondaryForeground)",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: "1",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onProfileMenuToggle(profileMenuOpen === profileKey ? null : profileKey);
            }}
            title={`More options for "${profileKey}"`}
          >
            <span
              style={{
                backgroundColor: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                lineHeight: "1",
              }}
              className="codicon codicon-more"
            ></span>
          </button>
          {profileMenuOpen === profileKey && (
            <div
              style={{
                position: "absolute",
                top: "28px",
                right: "4px",
                backgroundColor: "var(--vscode-dropdown-background)",
                border: "1px solid var(--vscode-dropdown-border)",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                zIndex: 1000,
                minWidth: "120px",
              }}
            >
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "none",
                  color: "var(--vscode-dropdown-foreground)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "var(--vscode-dropdown-hoverBackground)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onProfileMenuToggle(null);
                }}
              >
                <span className="codicon codicon-edit" style={{ marginRight: "6px", fontSize: "12px" }}></span>
                Rename (WIP)
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "none",
                  color: isProfileDefault(profileKey) ? "var(--vscode-textPreformat-foreground)" : "var(--vscode-dropdown-foreground)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "var(--vscode-dropdown-hoverBackground)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetAsDefault(profileKey);
                  onProfileMenuToggle(null);
                }}
              >
                <span className="codicon codicon-star" style={{ marginRight: "6px", fontSize: "12px" }}></span>
                {isProfileDefault(profileKey) ? "Currently Default" : "Set as Default"}
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "none",
                  color: "var(--vscode-dropdown-foreground)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "var(--vscode-dropdown-hoverBackground)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewArgs(profileKey);
                  onProfileMenuToggle(null);
                }}
              >
                <span className="codicon codicon-eye" style={{ marginRight: "6px", fontSize: "12px" }}></span>
                Preview Args (WIP)
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "none",
                  color: "var(--vscode-errorForeground)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "var(--vscode-dropdown-hoverBackground)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProfile(profileKey);
                  onProfileMenuToggle(null);
                }}
              >
                <span className="codicon codicon-trash" style={{ marginRight: "6px", fontSize: "12px" }}></span>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
