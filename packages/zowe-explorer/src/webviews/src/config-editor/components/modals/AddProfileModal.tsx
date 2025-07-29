import * as l10n from "@vscode/l10n";

interface AddProfileModalProps {
  isOpen: boolean;
  newProfileKey: string;
  newProfileValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  isSecure: boolean;
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
  onNewProfileKeyChange,
  onNewProfileValueChange,
  onShowDropdownChange,
  onSecureToggle,
  onAdd,
  onCancel,
}: AddProfileModalProps) {
  if (!isOpen) return null;

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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            placeholder={isSecure ? "••••••••" : l10n.t("Value")}
            value={newProfileValue}
            onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
            className="modal-input"
            type={isSecure ? "password" : "text"}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <button
            type="button"
            onClick={onSecureToggle}
            style={{
              background: isSecure ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
              border: isSecure ? "1px solid var(--vscode-button-border)" : "1px solid var(--vscode-button-secondaryBorder)",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "4px",
              color: isSecure ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "36px",
              minWidth: "36px",
            }}
            title={isSecure ? "Unlock property" : "Lock property"}
          >
            <span className={`codicon ${isSecure ? "codicon-lock" : "codicon-unlock"}`}></span>
          </button>
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
