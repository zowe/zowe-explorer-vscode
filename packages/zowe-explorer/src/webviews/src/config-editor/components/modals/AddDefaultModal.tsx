import * as l10n from "@vscode/l10n";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

interface AddDefaultModalProps {
  isOpen: boolean;
  newKey: string;
  newValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  availableProfiles: string[];
  profileType: string | null;
  onNewKeyChange: (value: string) => void;
  onNewValueChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function AddDefaultModal({
  isOpen,
  newKey,
  newValue,
  showDropdown,
  typeOptions,
  availableProfiles,
  profileType,
  onNewKeyChange,
  onNewValueChange,
  onShowDropdownChange,
  onAdd,
  onCancel,
}: AddDefaultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Default")}</h3>
        <div className="dropdown-container" style={{ position: "relative" }}>
          <input
            id="type-input"
            value={newKey}
            onChange={(e) => {
              onNewKeyChange((e.target as HTMLInputElement).value);
              onShowDropdownChange(true);
            }}
            onFocus={() => onShowDropdownChange(true)}
            onBlur={() => setTimeout(() => onShowDropdownChange(false), 100)}
            className="modal-input"
            placeholder={l10n.t("Default Key")}
            style={{ paddingRight: "2rem" }}
          />
          {newKey && (
            <button onClick={() => onNewKeyChange("")} className="profile-clear-button" title="Clear input">
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
                .filter((opt) => opt.toLowerCase().includes(newKey.toLowerCase()))
                .map((option, index) => (
                  <li
                    key={index}
                    className="dropdown-item"
                    onMouseDown={() => {
                      onNewKeyChange(option);
                      onShowDropdownChange(false);
                    }}
                  >
                    {option}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Default Value")}:</label>
          <select
            value={newValue}
            onChange={(e) => onNewValueChange((e.target as HTMLSelectElement).value)}
            className="modal-input"
            style={{
              width: "100%",
              height: "36px",
              position: "relative",
              zIndex: 1,
            }}
            disabled={!profileType}
          >
            <option value="">{profileType ? l10n.t("Select a profile") : l10n.t("Select a type first")}</option>
            {availableProfiles.map((profile) => (
              <option key={profile} value={profile}>
                {profile === "root" ? "/" : profile}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <VSCodeButton
            onClick={onCancel}
            appearance="secondary"
            style={{
              padding: "0.25rem 0.75rem",
              minWidth: "60px",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Cancel")}
          </VSCodeButton>
          <VSCodeButton
            onClick={onAdd}
            disabled={!profileType || !newValue}
            style={{
              padding: "0.25rem 0.75rem",
              minWidth: "60px",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Add")}
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
}
