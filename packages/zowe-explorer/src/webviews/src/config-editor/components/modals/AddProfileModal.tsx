import * as l10n from "@vscode/l10n";

interface AddProfileModalProps {
  isOpen: boolean;
  newProfileKey: string;
  newProfileValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  isSecure: boolean;
  getPropertyType: (propertyKey: string) => string | undefined;
  vscodeApi: any;
  onNewProfileKeyChange: (value: string) => void;
  onNewProfileValueChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onSecureToggle: () => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function AddProfileModal({
  isOpen,
  newProfileKey,
  newProfileValue,
  showDropdown,
  typeOptions,
  isSecure,
  getPropertyType,
  vscodeApi,
  onNewProfileKeyChange,
  onNewProfileValueChange,
  onShowDropdownChange,
  onSecureToggle,
  onAdd,
  onCancel,
}: AddProfileModalProps) {
  if (!isOpen) return null;

  const isFileProperty = (key: string): boolean => {
    // Check if key is defined and not null
    if (!key || typeof key !== "string") {
      return false;
    }

    // Keys that are file paths
    const filePaths = ["privateKey"];
    for (const path of filePaths) {
      if (key.toLowerCase() === path.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Profile Property")}</h3>
        <div className="dropdown-container" style={{ position: "relative" }}>
          <input
            id="profile-type-input"
            value={newProfileKey}
            onChange={(e) => {
              onNewProfileKeyChange((e.target as HTMLInputElement).value);
              onShowDropdownChange(true);
            }}
            onFocus={() => onShowDropdownChange(true)}
            onBlur={() => setTimeout(() => onShowDropdownChange(false), 100)}
            className="modal-input"
            placeholder={l10n.t("New Key")}
            style={{ paddingRight: "2rem" }}
          />
          {newProfileKey && (
            <button onClick={() => onNewProfileKeyChange("")} className="profile-clear-button" title="Clear input">
              <span
                className="codicon codicon-chrome-close"
                style={{
                  fontSize: "14px",
                  lineHeight: 1,
                }}
              />
            </button>
          )}
          {showDropdown && (
            <ul className="dropdown-list">
              {typeOptions
                .filter((opt) => opt.toLowerCase().includes(newProfileKey.toLowerCase()))
                .map((option, index) => (
                  <li
                    key={index}
                    className="dropdown-item"
                    onMouseDown={() => {
                      onNewProfileKeyChange(option);
                      onShowDropdownChange(false);
                    }}
                  >
                    {option}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "36px" }}>
          {(() => {
            const propertyType = getPropertyType(newProfileKey.trim());
            if (isSecure) {
              return (
                <input
                  placeholder="••••••••"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  className="modal-input"
                  type="password"
                  style={{ flex: 1, height: "36px", margin: 0 }}
                />
              );
            } else if (propertyType === "boolean") {
              return (
                <select
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLSelectElement).value)}
                  className="modal-input"
                  style={{ flex: 1, height: "36px", margin: 0 }}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              );
            } else if (propertyType === "number") {
              return (
                <input
                  type="number"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  className="modal-input"
                  placeholder={l10n.t("Value")}
                  style={{ flex: 1, height: "36px", margin: 0 }}
                />
              );
            } else {
              return (
                <input
                  type="text"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  className="modal-input"
                  placeholder={l10n.t("Value")}
                  style={{ flex: 1, height: "36px", margin: 0 }}
                />
              );
            }
          })()}
          <div style={{ display: "flex", gap: "4px", alignItems: "center", height: "36px" }}>
            {newProfileKey && isFileProperty(newProfileKey.trim()) && (
              <button
                onClick={() => {
                  // Use VS Code's showOpenDialog API to get the full file path
                  if (vscodeApi) {
                    vscodeApi.postMessage({
                      command: "SELECT_FILE",
                      propertyIndex: -1, // -1 indicates new property
                      isNewProperty: true,
                      source: "addProfile",
                    });
                  } else {
                    // Fallback to HTML file input if VS Code API is not available
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "*";

                    input.onchange = (event) => {
                      const target = event.target as HTMLInputElement;
                      if (target.files && target.files.length > 0) {
                        const file = target.files[0];
                        // In a webview context, we can't get the full file path directly
                        // We'll use the file name and let the user know they may need to provide the full path
                        const fileName = file.name;
                        // Try to get additional path info if available
                        const filePath = (file as any).webkitRelativePath || fileName;
                        onNewProfileValueChange(filePath);
                      }
                    };

                    input.click();
                  }
                }}
                style={{
                  padding: "6px",
                  height: "36px",
                  width: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--vscode-button-secondaryBackground)",
                  color: "var(--vscode-button-secondaryForeground)",
                  border: "1px solid var(--vscode-button-border)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  margin: 0,
                }}
                title="Select file"
              >
                <span className="codicon codicon-folder-opened"></span>
              </button>
            )}
            <button
              type="button"
              onClick={onSecureToggle}
              style={{
                background: isSecure ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                border: isSecure ? "1px solid var(--vscode-button-border)" : "1px solid var(--vscode-button-secondaryBorder)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                color: isSecure ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "36px",
                minWidth: "36px",
                margin: 0,
              }}
              title={isSecure ? "Unlock property" : "Lock property"}
            >
              <span className={`codicon ${isSecure ? "codicon-lock" : "codicon-unlock"}`}></span>
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <div style={{ display: "flex", justifyContent: "flex-end", flexGrow: 1 }}>
            <button
              style={{
                marginRight: 8,
                backgroundColor: "var(--vscode-button-secondaryBackground)",
                color: "var(--vscode-button-secondaryForeground)",
                border: "1px solid var(--vscode-button-secondaryBorder)",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={onCancel}
            >
              {l10n.t("Cancel")}
            </button>
            <button
              style={{
                backgroundColor: "var(--vscode-button-background)",
                color: "var(--vscode-button-foreground)",
                border: "1px solid var(--vscode-button-border)",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onClick={onAdd}
            >
              {l10n.t("Add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
