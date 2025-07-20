import * as l10n from "@vscode/l10n";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

interface AddDefaultModalProps {
  isOpen: boolean;
  newKey: string;
  newValue: string;
  showDropdown: boolean;
  typeOptions: string[];
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
        <div className="dropdown-container">
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
            placeholder={l10n.t("Type")}
          />
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

        <input
          placeholder={l10n.t("Profile (e.g. ssh1,my_lpar)")}
          value={newValue}
          onChange={(e) => onNewValueChange((e.target as HTMLInputElement).value)}
          className="modal-input"
        />
        <div className="modal-actions">
          <VSCodeButton onClick={onAdd}>{l10n.t("Add")}</VSCodeButton>
          <button onClick={onCancel}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );
}
