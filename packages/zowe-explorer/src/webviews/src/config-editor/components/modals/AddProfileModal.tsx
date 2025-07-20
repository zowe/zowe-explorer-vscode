import * as l10n from "@vscode/l10n";

interface AddProfileModalProps {
  isOpen: boolean;
  newProfileKey: string;
  newProfileValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  onNewProfileKeyChange: (value: string) => void;
  onNewProfileValueChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function AddProfileModal({
  isOpen,
  newProfileKey,
  newProfileValue,
  showDropdown,
  typeOptions,
  onNewProfileKeyChange,
  onNewProfileValueChange,
  onShowDropdownChange,
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

        <input
          placeholder={l10n.t("Value")}
          value={newProfileValue}
          onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
          className="modal-input"
        />
        <div className="modal-actions">
          <div style={{ display: "flex", alignItems: "center" }}>{/* Secure checkbox removed as per original code */}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", flexGrow: 1 }}>
            <button style={{ marginRight: 8 }} onClick={onAdd}>
              {l10n.t("Add")}
            </button>
            <button onClick={onCancel}>{l10n.t("Cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
